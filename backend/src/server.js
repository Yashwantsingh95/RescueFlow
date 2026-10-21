const http = require('http');
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { seedData } = require('./utils/seeder');
const { initSocketServer } = require('./services/socketService');
const { startExpiryWorker } = require('./services/expiryWorker');

// Load environment variables
dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// Initialize WebSockets (Socket.IO)
const io = initSocketServer(httpServer);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    platform: 'RESCUEFLOW Real-Time API',
    socketServer: 'active',
    time: new Date().toISOString()
  });
});

// Mount API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/donations', require('./routes/donationRoutes'));
app.use('/api/matching', require('./routes/matchingRoutes'));
app.use('/api/shelters', require('./routes/shelterRoutes'));
app.use('/api/drivers', require('./routes/driverRoutes'));
app.use('/api/rescues', require('./routes/rescueRoutes'));
app.use('/api/impact', require('./routes/impactRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/locations', require('./routes/locationRoutes'));
app.use('/api/map', require('./routes/mapRoutes'));
app.use('/api/users', require('./routes/userRoutes'));

// Serve production static frontend if built
const path = require('path');
const fs = require('fs');
const distPath = path.resolve(__dirname, '../../dist');

if (fs.existsSync(distPath)) {
  console.log(`[RESCUEFLOW] Serving production client build from: ${distPath}`);
  app.use(express.static(distPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/socket.io')) {
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
}

// 404 & Centralized Error Handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDB();

    // Auto-seed demo data if database is empty or explicitly enabled
    const User = require('./models/User');
    const userCount = await User.countDocuments();
    if (process.env.SEED_DEMO === 'true' || userCount === 0) {
      console.log(`[RESCUEFLOW] Seeding initial demo data (existing users = ${userCount})...`);
      await seedData();
    }

    // Start background expiry worker
    startExpiryWorker(30000);

    httpServer.listen(PORT, () => {
      console.log(`[RESCUEFLOW Backend] Production Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

module.exports = { app, httpServer };
