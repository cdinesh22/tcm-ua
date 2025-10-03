const express = require('express');
const { body, validationResult } = require('express-validator');
const ContactMessage = require('../models/ContactMessage');

const router = express.Router();

// @route   POST /api/contact
// @desc    Submit a contact message
// @access  Public
router.post('/', [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').trim().isLength({ min: 10 }).withMessage('Message must be at least 10 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const payload = {
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      subject: req.body.subject,
      message: req.body.message,
      meta: {
        ip: req.ip,
        userAgent: req.headers['user-agent'] || ''
      }
    };

    const saved = await ContactMessage.create(payload);

    res.status(201).json({
      success: true,
      message: 'Message received',
      data: { id: saved._id }
    });
  } catch (error) {
    console.error('Contact submit error:', error);
    res.status(500).json({ success: false, message: 'Server error while submitting message' });
  }
});

module.exports = router;
