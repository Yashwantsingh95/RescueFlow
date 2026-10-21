const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const axios = require('axios');
const User = require('../models/User');
const Shelter = require('../models/Shelter');
const Driver = require('../models/Driver');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET || 'rescueflow_super_secret_jwt_key_2026_amihacks',
    { expiresIn: '30d' }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, location } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, password, and role'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email is already registered'
      });
    }

    const userLocation = (location && Array.isArray(location.coordinates) && location.coordinates.length === 2 && !isNaN(location.coordinates[0]) && !isNaN(location.coordinates[1]))
      ? {
          type: 'Point',
          coordinates: [Number(location.coordinates[0]), Number(location.coordinates[1])],
          address: location.address || ''
        }
      : undefined;

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      authProvider: 'LOCAL',
      role: role.toUpperCase(),
      ...(userLocation ? { location: userLocation } : {})
    });

    // Auto-scaffold Shelter or Driver profile if applicable
    if (user.role === 'SHELTER') {
      await Shelter.create({
        userId: user._id,
        name: user.name,
        ...(userLocation ? { location: userLocation } : {}),
        capacity: 100,
        currentOccupancy: 0,
        foodPreferences: ['Vegetarian', 'Cooked Meals', 'All'],
        currentNeed: 'HIGH'
      });
    } else if (user.role === 'DRIVER') {
      await Driver.create({
        userId: user._id,
        name: user.name,
        phone: '+91 98765 43210',
        vehicle: 'Hero Electric Eco-Van',
        location: {
          type: 'Point',
          coordinates: [77.2102, 28.6145]
        },
        availability: 'AVAILABLE'
      });
    }

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        location: user.location
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user with email/password
// @route   POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please create a new account.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please verify and try again.'
      });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        location: user.location
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Google Sign-In / OAuth verification
// @route   POST /api/auth/google
exports.googleAuth = async (req, res, next) => {
  try {
    const { token: idToken, accessToken, role = 'DONOR', location, isDemo, email: demoEmail, name: demoName } = req.body;

    if (!idToken && !accessToken && !isDemo) {
      return res.status(400).json({
        success: false,
        message: 'Google credentials token is required'
      });
    }

    let googleData = null;

    // Demo Google token fallback for testing before setting up Google Cloud Console credentials
    if (isDemo || idToken === 'demo-google-token') {
      googleData = {
        googleId: 'google-demo-user-12345',
        email: (demoEmail || 'google.donor@rescueflow.org').toLowerCase(),
        name: demoName || 'Google Verified Partner',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
      };
    }

    // 1. Try Google OAuth ID token verification
    if (idToken) {
      try {
        if (process.env.GOOGLE_CLIENT_ID) {
          const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
          });
          const payload = ticket.getPayload();
          googleData = {
            googleId: payload.sub,
            email: payload.email,
            name: payload.name,
            picture: payload.picture
          };
        } else {
          // If no GOOGLE_CLIENT_ID in dev env yet, query tokeninfo endpoint directly
          const tokenInfoRes = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
          googleData = {
            googleId: tokenInfoRes.data.sub,
            email: tokenInfoRes.data.email,
            name: tokenInfoRes.data.name || tokenInfoRes.data.email.split('@')[0],
            picture: tokenInfoRes.data.picture || ''
          };
        }
      } catch (tokenErr) {
        console.warn('[Google Auth] ID Token verify warning:', tokenErr.message);
      }
    }

    // 2. Try Google Access Token if ID token wasn't provided or failed
    if (!googleData && accessToken) {
      try {
        const userInfoRes = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        googleData = {
          googleId: userInfoRes.data.sub,
          email: userInfoRes.data.email,
          name: userInfoRes.data.name,
          picture: userInfoRes.data.picture
        };
      } catch (accessErr) {
        console.warn('[Google Auth] Access Token verify warning:', accessErr.message);
      }
    }

    if (!googleData || !googleData.email) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired Google authentication credentials'
      });
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { googleId: googleData.googleId },
        { email: googleData.email.toLowerCase() }
      ]
    });

    if (user) {
      // Update Google metadata if not set
      if (!user.googleId) user.googleId = googleData.googleId;
      if (!user.avatar) user.avatar = googleData.picture;
      await user.save();
    } else {
      // First-time registration with selected role
      user = await User.create({
        name: googleData.name,
        email: googleData.email.toLowerCase(),
        authProvider: 'GOOGLE',
        googleId: googleData.googleId,
        avatar: googleData.picture,
        role: role.toUpperCase(),
        location: location || {
          type: 'Point',
          coordinates: [77.2090, 28.6139],
          address: 'Connaught Place, New Delhi'
        }
      });

      if (user.role === 'SHELTER') {
        await Shelter.create({
          userId: user._id,
          name: user.name,
          location: user.location,
          capacity: 100,
          currentOccupancy: 20,
          foodPreferences: ['Vegetarian', 'Cooked Meals', 'All'],
          currentNeed: 'HIGH'
        });
      } else if (user.role === 'DRIVER') {
        await Driver.create({
          userId: user._id,
          name: user.name,
          phone: '+91 98765 43210',
          vehicle: 'Hero Electric Eco-Van',
          location: user.location,
          availability: 'AVAILABLE'
        });
      }
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        location: user.location
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    let extra = {};

    if (user.role === 'SHELTER') {
      extra.shelter = await Shelter.findOne({ userId: user._id });
    } else if (user.role === 'DRIVER') {
      extra.driver = await Driver.findOne({ userId: user._id });
    }

    res.json({
      success: true,
      user,
      ...extra
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public authentication configuration
// @route   GET /api/auth/config
exports.getAuthConfig = (req, res) => {
  res.json({
    success: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
  });
};

// @desc    Seed database on demand
// @route   GET /api/auth/seed
exports.triggerSeed = async (req, res, next) => {
  try {
    const { seedData } = require('../utils/seeder');
    await seedData();
    res.json({
      success: true,
      message: 'Demo accounts seeded successfully!'
    });
  } catch (error) {
    next(error);
  }
};

