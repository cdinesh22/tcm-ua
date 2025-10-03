const express = require('express');
const moment = require('moment');
const Slot = require('../models/Slot');
const Temple = require('../models/Temple');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/slots
// @desc    Get available slots for a temple
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { temple, date, startDate, endDate } = req.query;

    if (!temple) {
      return res.status(400).json({
        success: false,
        message: 'Temple ID is required'
      });
    }

    let query = { temple, isActive: true };

    // Date filtering
    if (date) {
      const queryDate = moment(date).startOf('day').toDate();
      const nextDay = moment(date).add(1, 'day').startOf('day').toDate();
      query.date = { $gte: queryDate, $lt: nextDay };
    } else if (startDate && endDate) {
      query.date = {
        $gte: moment(startDate).startOf('day').toDate(),
        $lte: moment(endDate).endOf('day').toDate()
      };
    } else {
      // Default to next 7 days
      query.date = {
        $gte: moment().startOf('day').toDate(),
        $lte: moment().add(7, 'days').endOf('day').toDate()
      };
    }

    const slots = await Slot.find(query)
      .populate('temple', 'name location capacity')
      .sort({ date: 1, startTime: 1 });

    // Group slots by date
    const slotsByDate = {};
    slots.forEach(slot => {
      const dateKey = moment(slot.date).format('YYYY-MM-DD');
      if (!slotsByDate[dateKey]) {
        slotsByDate[dateKey] = [];
      }
      slotsByDate[dateKey].push({
        id: slot._id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        availableSpots: slot.availableSpots,
        occupancyPercentage: slot.occupancyPercentage,
        price: slot.price,
        status: slot.status,
        specialEvent: slot.specialEvent,
        isBookable: slot.isBookable()
      });
    });

    res.json({
      success: true,
      count: slots.length,
      data: { 
        slots: slotsByDate,
        temple: slots.length > 0 ? slots[0].temple : null
      }
    });

  } catch (error) {
    console.error('Get slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching slots'
    });
  }
});

// @route   GET /api/slots/:id
// @desc    Get single slot by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.id)
      .populate('temple', 'name location capacity timings');

    if (!slot || !slot.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }

    res.json({
      success: true,
      data: { slot }
    });

  } catch (error) {
    console.error('Get slot error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while fetching slot'
    });
  }
});

// @route   POST /api/slots
// @desc    Create new slot (Admin only)
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { temple, date, startTime, endTime, capacity, price, specialEvent } = req.body;

    // Validate temple exists
    const templeDoc = await Temple.findById(temple);
    if (!templeDoc) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    // Check for overlapping slots
    const overlappingSlot = await Slot.findOne({
      temple,
      date: moment(date).startOf('day').toDate(),
      $or: [
        { startTime: { $lt: endTime }, endTime: { $gt: startTime } }
      ],
      isActive: true
    });

    if (overlappingSlot) {
      return res.status(400).json({
        success: false,
        message: 'Slot time overlaps with existing slot'
      });
    }

    const slot = await Slot.create({
      temple,
      date: moment(date).startOf('day').toDate(),
      startTime,
      endTime,
      capacity: capacity || templeDoc.capacity.maxVisitorsPerSlot,
      price: price || 0,
      specialEvent
    });

    await slot.populate('temple', 'name location');

    res.status(201).json({
      success: true,
      message: 'Slot created successfully',
      data: { slot }
    });

  } catch (error) {
    console.error('Create slot error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while creating slot'
    });
  }
});

// @route   POST /api/slots/bulk
// @desc    Create multiple slots for a date range (Admin only)
// @access  Private/Admin
router.post('/bulk', protect, adminOnly, async (req, res) => {
  try {
    const { temple, startDate, endDate, timeSlots, capacity, price } = req.body;

    // Validate temple exists
    const templeDoc = await Temple.findById(temple);
    if (!templeDoc) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    const slots = [];
    const start = moment(startDate);
    const end = moment(endDate);

    // Generate slots for each day in the range
    while (start.isSameOrBefore(end)) {
      for (const timeSlot of timeSlots) {
        const slot = {
          temple,
          date: start.clone().startOf('day').toDate(),
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          capacity: capacity || templeDoc.capacity.maxVisitorsPerSlot,
          price: price || 0
        };
        slots.push(slot);
      }
      start.add(1, 'day');
    }

    // Insert all slots
    const createdSlots = await Slot.insertMany(slots);

    res.status(201).json({
      success: true,
      message: `${createdSlots.length} slots created successfully`,
      data: { count: createdSlots.length }
    });

  } catch (error) {
    console.error('Bulk create slots error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating slots'
    });
  }
});

// @route   PUT /api/slots/:id
// @desc    Update slot (Admin only)
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const slot = await Slot.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('temple', 'name location');

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }

    res.json({
      success: true,
      message: 'Slot updated successfully',
      data: { slot }
    });

  } catch (error) {
    console.error('Update slot error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error while updating slot'
    });
  }
});

// @route   DELETE /api/slots/:id
// @desc    Delete slot (Admin only)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const slot = await Slot.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }

    res.json({
      success: true,
      message: 'Slot deleted successfully'
    });

  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting slot'
    });
  }
});

// @route   GET /api/slots/:id/availability
// @desc    Check slot availability
// @access  Public
router.get('/:id/availability', async (req, res) => {
  try {
    const { visitors = 1 } = req.query;
    const slot = await Slot.findById(req.params.id);

    if (!slot || !slot.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Slot not found'
      });
    }

    const isAvailable = slot.isBookable(parseInt(visitors));

    res.json({
      success: true,
      data: {
        available: isAvailable,
        availableSpots: slot.availableSpots,
        requestedSpots: parseInt(visitors),
        capacity: slot.capacity,
        bookedCount: slot.bookedCount,
        status: slot.status
      }
    });

  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while checking availability'
    });
  }
});

module.exports = router;
