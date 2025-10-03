const express = require('express');
const QRCode = require('qrcode');
const moment = require('moment');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Temple = require('../models/Temple');
const User = require('../models/User');
const { protect, pilgrimOnly, adminOnly } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private/Pilgrim
router.post('/', protect, pilgrimOnly, [
  body('slotId').notEmpty().withMessage('Slot ID is required'),
  body('visitorsCount').isInt({ min: 1, max: 10 }).withMessage('Visitors count must be between 1 and 10'),
  body('visitors').isArray({ min: 1 }).withMessage('At least one visitor is required'),
  body('visitors.*.name').trim().isLength({ min: 2 }).withMessage('Visitor name is required'),
  body('visitors.*.age').isInt({ min: 0, max: 120 }).withMessage('Valid age is required'),
  body('visitors.*.gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { slotId, visitorsCount, visitors, specialRequests } = req.body;

    // Validate slot exists and is bookable
    const slot = await Slot.findById(slotId).populate('temple');
    if (!slot || !slot.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }

    if (!slot.isBookable(visitorsCount)) {
      return res.status(400).json({
        success: false,
        message: 'Slot is not available for the requested number of visitors'
      });
    }

    // Validate visitors count matches visitors array
    if (visitors.length !== visitorsCount) {
      return res.status(400).json({
        success: false,
        message: 'Visitors count does not match visitors data'
      });
    }

    // Calculate total amount
    let totalAmount = slot.price * visitorsCount;
    if (slot.specialEvent && slot.specialEvent.additionalPrice) {
      totalAmount += slot.specialEvent.additionalPrice * visitorsCount;
    }

    // Create booking
    const booking = new Booking({
      user: req.user.id,
      temple: slot.temple._id,
      slot: slotId,
      visitorsCount,
      visitors,
      contactInfo: {
        email: req.user.email,
        phone: req.user.phone
      },
      totalAmount,
      specialRequests: specialRequests || []
    });

    // Generate QR code
    const qrData = {
      bookingId: booking.bookingId,
      temple: slot.temple.name,
      date: moment(slot.date).format('YYYY-MM-DD'),
      time: `${slot.startTime} - ${slot.endTime}`,
      visitors: visitorsCount,
      user: req.user.name
    };

    const qrCodeUrl = await QRCode.toDataURL(JSON.stringify(qrData));
    booking.qrCode = qrCodeUrl;

    // Save booking
    await booking.save();

    // Update slot booking count
    slot.bookedCount += visitorsCount;
    await slot.save();

    // Add booking to user's history
    await User.findByIdAndUpdate(req.user.id, {
      $push: { bookingHistory: booking._id }
    });

    // Populate booking data for response
    await booking.populate([
      { path: 'temple', select: 'name location' },
      { path: 'slot', select: 'date startTime endTime' },
      { path: 'user', select: 'name email phone' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating booking'
    });
  }
});

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let query = { user: req.user.id };
    if (status) {
      query.status = status;
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: 'temple', select: 'name location images' },
        { path: 'slot', select: 'date startTime endTime' }
      ]
    };

    const bookings = await Booking.find(query)
      .populate(options.populate)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      count: bookings.length,
      total,
      page: options.page,
      pages: Math.ceil(total / options.limit),
      data: { bookings }
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings'
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Non-admin users can only see their own bookings
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const booking = await Booking.findOne(query)
      .populate('temple', 'name location images facilities emergencyContacts')
      .populate('slot', 'date startTime endTime capacity')
      .populate('user', 'name email phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: { booking }
    });

  } catch (error) {
    console.error('Get booking error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking'
    });
  }
});

// @route   PUT /api/bookings/:id/cancel
// @desc    Cancel booking
// @access  Private
router.put('/:id/cancel', protect, async (req, res) => {
  try {
    let query = { _id: req.params.id };
    
    // Non-admin users can only cancel their own bookings
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const booking = await Booking.findOne(query).populate('slot');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!booking.canBeCancelled()) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be cancelled. Cancellation is allowed up to 2 hours before the slot time.'
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    await booking.save();

    // Update slot booking count
    const slot = await Slot.findById(booking.slot._id);
    if (slot) {
      slot.bookedCount = Math.max(0, slot.bookedCount - booking.visitorsCount);
      await slot.save();
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: { booking }
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while cancelling booking'
    });
  }
});

// @route   PUT /api/bookings/:id/checkin
// @desc    Check-in for booking (Admin only)
// @access  Private/Admin
router.put('/:id/checkin', protect, adminOnly, [
  body('latitude').optional().isFloat().withMessage('Valid latitude is required'),
  body('longitude').optional().isFloat().withMessage('Valid longitude is required')
], async (req, res) => {
  try {
    const { latitude, longitude, verifiedBy } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Only confirmed bookings can be checked in'
      });
    }

    if (booking.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already checked in'
      });
    }

    // Update check-in information
    booking.checkIn = {
      time: new Date(),
      location: latitude && longitude ? { latitude, longitude } : undefined,
      verifiedBy: verifiedBy || req.user.name
    };

    await booking.save();

    res.json({
      success: true,
      message: 'Check-in successful',
      data: { booking }
    });

  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-in'
    });
  }
});

// @route   PUT /api/bookings/:id/checkout
// @desc    Check-out for booking (Admin only)
// @access  Private/Admin
router.put('/:id/checkout', protect, adminOnly, [
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters')
], async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (!booking.checkIn.time) {
      return res.status(400).json({
        success: false,
        message: 'Booking must be checked in before checkout'
      });
    }

    if (booking.checkOut.time) {
      return res.status(400).json({
        success: false,
        message: 'Booking is already checked out'
      });
    }

    // Update check-out information
    booking.checkOut = {
      time: new Date(),
      feedback: rating || comment ? { rating, comment } : undefined
    };
    booking.status = 'completed';

    await booking.save();

    res.json({
      success: true,
      message: 'Check-out successful',
      data: { booking }
    });

  } catch (error) {
    console.error('Check-out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during check-out'
    });
  }
});

// @route   GET /api/bookings/qr/:bookingId
// @desc    Get QR code for booking
// @access  Private
router.get('/qr/:bookingId', protect, async (req, res) => {
  try {
    let query = { bookingId: req.params.bookingId };
    
    // Non-admin users can only see their own bookings
    if (req.user.role !== 'admin') {
      query.user = req.user.id;
    }

    const booking = await Booking.findOne(query);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: { 
        qrCode: booking.qrCode,
        bookingId: booking.bookingId
      }
    });

  } catch (error) {
    console.error('Get QR code error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching QR code'
    });
  }
});

module.exports = router;
