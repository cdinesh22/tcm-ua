const express = require('express');
const moment = require('moment');
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Slot = require('../models/Slot');
const Temple = require('../models/Temple');
const User = require('../models/User');
const CrowdSimulation = require('../models/CrowdSimulation');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard data
// @access  Private/Admin
router.get('/dashboard', protect, adminOnly, async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    const tomorrow = moment().add(1, 'day').startOf('day').toDate();
    const thisWeek = moment().startOf('week').toDate();
    const thisMonth = moment().startOf('month').toDate();

    // Get basic counts
    const [
      totalTemples,
      totalUsers,
      todayBookings,
      weekBookings,
      monthBookings,
      activeSlots,
      pendingBookings
    ] = await Promise.all([
      Temple.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'pilgrim' }),
      Booking.countDocuments({ 
        createdAt: { $gte: today, $lt: tomorrow },
        status: { $ne: 'cancelled' }
      }),
      Booking.countDocuments({ 
        createdAt: { $gte: thisWeek },
        status: { $ne: 'cancelled' }
      }),
      Booking.countDocuments({ 
        createdAt: { $gte: thisMonth },
        status: { $ne: 'cancelled' }
      }),
      Slot.countDocuments({ 
        date: { $gte: today },
        isActive: true,
        status: 'available'
      }),
      Booking.countDocuments({ 
        status: 'confirmed',
        paymentStatus: 'pending'
      })
    ]);

    // Get revenue data
    const revenueData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thisMonth },
          paymentStatus: 'completed',
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalBookings: { $sum: 1 },
          totalVisitors: { $sum: '$visitorsCount' }
        }
      }
    ]);

    // Get temple-wise bookings
    const templeBookings = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thisWeek },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$temple',
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'temples',
          localField: '_id',
          foreignField: '_id',
          as: 'temple'
        }
      },
      {
        $unwind: '$temple'
      },
      {
        $project: {
          templeName: '$temple.name',
          bookings: 1,
          visitors: 1,
          revenue: 1
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 5 }
    ]);

    // Get recent bookings
    const recentBookings = await Booking.find({
      createdAt: { $gte: moment().subtract(24, 'hours').toDate() }
    })
    .populate('temple', 'name')
    .populate('user', 'name email')
    .populate('slot', 'date startTime')
    .sort({ createdAt: -1 })
    .limit(10);

    // Get crowd alerts
    const crowdAlerts = await CrowdSimulation.aggregate([
      { $unwind: '$alerts' },
      {
        $match: {
          'alerts.isActive': true,
          'alerts.severity': { $in: ['high', 'critical'] }
        }
      },
      {
        $lookup: {
          from: 'temples',
          localField: 'temple',
          foreignField: '_id',
          as: 'temple'
        }
      },
      { $unwind: '$temple' },
      {
        $project: {
          templeName: '$temple.name',
          alert: '$alerts',
          date: 1
        }
      },
      { $sort: { 'alert.time': -1 } },
      { $limit: 5 }
    ]);

    const dashboardData = {
      stats: {
        totalTemples,
        totalUsers,
        todayBookings,
        weekBookings,
        monthBookings,
        activeSlots,
        pendingBookings,
        revenue: revenueData[0] || { totalRevenue: 0, totalBookings: 0, totalVisitors: 0 }
      },
      templeBookings,
      recentBookings,
      crowdAlerts
    };

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard data'
    });
  }
});

// @route   GET /api/admin/bookings
// @desc    Get all bookings (Admin view)
// @access  Private/Admin
router.get('/bookings', protect, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      temple, 
      date,
      search 
    } = req.query;

    let query = {};

    // Add filters
    if (status) query.status = status;
    if (temple) query.temple = temple;
    if (date) {
      const queryDate = moment(date).startOf('day').toDate();
      const nextDay = moment(date).add(1, 'day').startOf('day').toDate();
      query.createdAt = { $gte: queryDate, $lt: nextDay };
    }

    // Search functionality
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { bookingId: searchRegex }
      ];
    }

    const bookings = await Booking.find(query)
      .populate('temple', 'name location')
      .populate('user', 'name email phone')
      .populate('slot', 'date startTime endTime')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      success: true,
      count: bookings.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: { bookings }
    });

  } catch (error) {
    console.error('Admin get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching bookings'
    });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users (Admin view)
// @access  Private/Admin
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      role, 
      search 
    } = req.query;

    let query = {};

    if (role) query.role = role;

    // Search functionality
    if (search) {
      const searchRegex = { $regex: search, $options: 'i' };
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      count: users.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: { users }
    });

  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching users'
    });
  }
});

// @route   PUT /api/admin/users/:id/status
// @desc    Update user status (Admin only)
// @access  Private/Admin
router.put('/users/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { isVerified } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User status updated successfully',
      data: { user }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating user status'
    });
  }
});

// @route   GET /api/admin/analytics/bookings
// @desc    Get booking analytics
// @access  Private/Admin
router.get('/analytics/bookings', protect, adminOnly, async (req, res) => {
  try {
    const { period = 'week', temple } = req.query;

    let startDate, groupBy;
    switch (period) {
      case 'day':
        startDate = moment().subtract(24, 'hours').toDate();
        groupBy = { $hour: '$createdAt' };
        break;
      case 'week':
        startDate = moment().subtract(7, 'days').toDate();
        groupBy = { $dayOfWeek: '$createdAt' };
        break;
      case 'month':
        startDate = moment().subtract(30, 'days').toDate();
        groupBy = { $dayOfMonth: '$createdAt' };
        break;
      case 'year':
        startDate = moment().subtract(12, 'months').toDate();
        groupBy = { $month: '$createdAt' };
        break;
      default:
        startDate = moment().subtract(7, 'days').toDate();
        groupBy = { $dayOfWeek: '$createdAt' };
    }

    let matchQuery = {
      createdAt: { $gte: startDate },
      status: { $ne: 'cancelled' }
    };

    if (temple) {
      matchQuery.temple = mongoose.Types.ObjectId(temple);
    }

    const analytics = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      data: { analytics, period }
    });

  } catch (error) {
    console.error('Booking analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching booking analytics'
    });
  }
});

// @route   GET /api/admin/reports/daily
// @desc    Get daily report
// @access  Private/Admin
router.get('/reports/daily', protect, adminOnly, async (req, res) => {
  try {
    const { date = moment().format('YYYY-MM-DD') } = req.query;
    
    const queryDate = moment(date).startOf('day').toDate();
    const nextDay = moment(date).add(1, 'day').startOf('day').toDate();

    // Get daily statistics
    const [bookingStats, revenueStats, templeStats] = await Promise.all([
      // Booking statistics
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: queryDate, $lt: nextDay }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            visitors: { $sum: '$visitorsCount' },
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]),

      // Revenue by temple
      Booking.aggregate([
        {
          $match: {
            createdAt: { $gte: queryDate, $lt: nextDay },
            paymentStatus: 'completed'
          }
        },
        {
          $group: {
            _id: '$temple',
            revenue: { $sum: '$totalAmount' },
            bookings: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: 'temples',
            localField: '_id',
            foreignField: '_id',
            as: 'temple'
          }
        },
        { $unwind: '$temple' },
        {
          $project: {
            templeName: '$temple.name',
            revenue: 1,
            bookings: 1
          }
        }
      ]),

      // Temple occupancy
      Temple.aggregate([
        {
          $project: {
            name: 1,
            currentOccupancy: '$currentStatus.currentOccupancy',
            maxCapacity: '$capacity.maxVisitorsPerSlot',
            occupancyPercentage: {
              $multiply: [
                { $divide: ['$currentStatus.currentOccupancy', '$capacity.maxVisitorsPerSlot'] },
                100
              ]
            }
          }
        }
      ])
    ]);

    const report = {
      date,
      bookingStats,
      revenueStats,
      templeStats,
      summary: {
        totalBookings: bookingStats.reduce((sum, stat) => sum + stat.count, 0),
        totalVisitors: bookingStats.reduce((sum, stat) => sum + stat.visitors, 0),
        totalRevenue: revenueStats.reduce((sum, stat) => sum + stat.revenue, 0)
      }
    };

    res.json({
      success: true,
      data: { report }
    });

  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating daily report'
    });
  }
});

module.exports = router;
