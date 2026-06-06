import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Get user status (whether any users exist in the database)
// @route   GET /api/auth/status
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    res.json({ hasUsers: userCount > 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check system auth status' });
  }
});

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public (Only if no users exist for bootstrapping) / Admin (Otherwise)
router.post('/register', async (req, res) => {
  try {
    const { username, password, fullName, role, allowedStations } = req.body;

    if (!username || !password || !fullName) {
      return res.status(400).json({ error: 'Please provide username, password, and full name' });
    }

    const userCount = await User.countDocuments();
    
    // If users exist, enforce Admin authorization
    if (userCount > 0) {
      // Manual authentication checks since we can't easily chain middleware conditionally on dynamic state
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ error: 'Not authorized to register users. Admin login required.' });
      }

      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const creator = await User.findById(decoded.id);
        if (!creator || creator.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can register new users' });
        }
      } catch (err) {
        return res.status(401).json({ error: 'Token verification failed. Please log in as Admin again.' });
      }
    }

    // Check if user already exists
    const userExists = await User.findOne({ username: username.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Bootstrap first user as admin, subsequent users use requested role or default to operator
    const finalRole = userCount === 0 ? 'admin' : (role || 'operator');
    const finalStations = userCount === 0 ? ['order', 'return'] : (allowedStations || ['order', 'return']);

    const user = await User.create({
      username,
      password,
      fullName,
      role: finalRole,
      allowedStations: finalStations,
    });

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        allowedStations: user.allowedStations,
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Please provide username and password' });
    }

    // Find user
    const user = await User.findOne({ username: username.toLowerCase() });

    // Validate credentials
    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        user: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          allowedStations: user.allowedStations,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile' });
  }
});

// @desc    Get all users (for management)
// @route   GET /api/auth/users
// @access  Private/Admin
router.get('/users', protect, authorize('admin'), async (req, res) => {
  try {
    const users = await User.find({}).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// @desc    Delete a user
// @route   DELETE /api/auth/users/:id
// @access  Private/Admin
router.delete('/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const userIdToDelete = req.params.id;

    // Prevent admin from deleting themselves
    if (userIdToDelete === req.user._id.toString()) {
      return res.status(400).json({ error: 'Admins cannot delete their own account' });
    }

    const user = await User.findById(userIdToDelete);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.deleteOne({ _id: userIdToDelete });
    res.json({ success: true, message: `Successfully deleted user ${user.username}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user: ' + error.message });
  }
});

export default router;
