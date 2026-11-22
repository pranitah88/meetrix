const router = require('express').Router();
const jwt    = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User   = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'meetrix_dev_fallback_secret_key_change_in_production';

const signToken = (user) =>
  jwt.sign({ id: user._id, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register',
  body('name').notEmpty().trim(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { name, email, password } = req.body;
    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already registered' });

    const user  = await User.create({ name, email, password });
    const token = signToken(user);
    res.status(201).json({ token, user });
  }
);

// POST /api/auth/login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user });
  }
);

module.exports = router;
