const express = require('express');
const router = express.Router();
const { register, login, googleAuth, getMe, getAuthConfig, triggerSeed } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.get('/config', getAuthConfig);
router.get('/seed', triggerSeed);
router.get('/me', protect, getMe);

module.exports = router;
