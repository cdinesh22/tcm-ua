const express = require('express');
const moment = require('moment');
const Booking = require('../models/Booking');
const Temple = require('../models/Temple');
const User = require('../models/User');
const CrowdSimulation = require('../models/CrowdSimulation');
const { protect, adminOnly } = require('../middleware/auth');
const mongoose = require('mongoose');

const router = express.Router();

// @route   GET /api/analytics/overview
// @desc    Get analytics overview
// @access  Private/Admin
router.get('/overview', protect, adminOnly, async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    let startDate;
    switch (period) {
      case 'week':
        startDate = moment().subtract(7, 'days').toDate();
        break;
      case 'month':
        startDate = moment().subtract(30, 'days').toDate();
        break;
      case 'quarter':
        startDate = moment().subtract(3, 'months').toDate();
        break;
      case 'year':
        startDate = moment().subtract(12, 'months').toDate();
        break;
      default:
        startDate = moment().subtract(30, 'days').toDate();
    }

    // Get booking trends
    const bookingTrends = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get temple performance
    const templePerformance = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: '$temple',
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' },
          revenue: { $sum: '$totalAmount' },
          avgRating: { $avg: '$checkOut.feedback.rating' }
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
          location: '$temple.location.city',
          bookings: 1,
          visitors: 1,
          revenue: 1,
          avgRating: { $round: ['$avgRating', 1] }
        }
      },
      {
        $sort: { bookings: -1 }
      }
    ]);

    // Get user demographics
    const userDemographics = await User.aggregate([
      {
        $match: { role: 'pilgrim' }
      },
      {
        $group: {
          _id: '$preferences.language',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get peak hours analysis
    const peakHours = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'slots',
          localField: 'slot',
          foreignField: '_id',
          as: 'slot'
        }
      },
      {
        $unwind: '$slot'
      },
      {
        $addFields: {
          hour: { $toInt: { $substr: ['$slot.startTime', 0, 2] } }
        }
      },
      {
        $group: {
          _id: '$hour',
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get cancellation analysis
    const cancellationAnalysis = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const overview = {
      period,
      bookingTrends,
      templePerformance,
      userDemographics,
      peakHours,
      cancellationAnalysis,
      summary: {
        totalBookings: bookingTrends.reduce((sum, trend) => sum + trend.bookings, 0),
        totalVisitors: bookingTrends.reduce((sum, trend) => sum + trend.visitors, 0),
        totalRevenue: bookingTrends.reduce((sum, trend) => sum + trend.revenue, 0),
        avgBookingsPerDay: bookingTrends.length > 0 ? 
          Math.round(bookingTrends.reduce((sum, trend) => sum + trend.bookings, 0) / bookingTrends.length) : 0
      }
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics overview'
    });
  }
});

// @route   GET /api/analytics/temple/:templeId
// @desc    Get temple-specific analytics
// @access  Private/Admin
router.get('/temple/:templeId', protect, adminOnly, async (req, res) => {
  try {
    const { templeId } = req.params;
    const { period = 'month' } = req.query;

    let startDate;
    switch (period) {
      case 'week':
        startDate = moment().subtract(7, 'days').toDate();
        break;
      case 'month':
        startDate = moment().subtract(30, 'days').toDate();
        break;
      case 'quarter':
        startDate = moment().subtract(3, 'months').toDate();
        break;
      default:
        startDate = moment().subtract(30, 'days').toDate();
    }

    const temple = await Temple.findById(templeId);
    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    // Get booking statistics
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          temple: temple._id,
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
      }
    ]);

    // Get slot utilization
    const slotUtilization = await Booking.aggregate([
      {
        $match: {
          temple: temple._id,
          createdAt: { $gte: startDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $lookup: {
          from: 'slots',
          localField: 'slot',
          foreignField: '_id',
          as: 'slot'
        }
      },
      {
        $unwind: '$slot'
      },
      {
        $group: {
          _id: '$slot.startTime',
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' },
          avgOccupancy: { $avg: { $divide: ['$visitorsCount', '$slot.capacity'] } }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get visitor feedback
    const visitorFeedback = await Booking.aggregate([
      {
        $match: {
          temple: temple._id,
          'checkOut.feedback.rating': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$checkOut.feedback.rating',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get crowd density trends
    const crowdTrends = await CrowdSimulation.aggregate([
      {
        $match: {
          temple: temple._id,
          date: { $gte: startDate }
        }
      },
      {
        $unwind: '$hourlyData'
      },
      {
        $group: {
          _id: '$hourlyData.hour',
          avgExpected: { $avg: '$hourlyData.expectedVisitors' },
          avgActual: { $avg: '$hourlyData.actualVisitors' },
          avgWaitTime: { $avg: '$hourlyData.waitTime' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    // Get alert history
    const alertHistory = await CrowdSimulation.aggregate([
      {
        $match: {
          temple: temple._id,
          date: { $gte: startDate }
        }
      },
      {
        $unwind: '$alerts'
      },
      {
        $group: {
          _id: {
            type: '$alerts.type',
            severity: '$alerts.severity'
          },
          count: { $sum: 1 },
          avgResolutionTime: {
            $avg: {
              $subtract: ['$alerts.resolvedAt', '$alerts.time']
            }
          }
        }
      }
    ]);

    const analytics = {
      temple: {
        id: temple._id,
        name: temple.name,
        location: temple.location,
        capacity: temple.capacity
      },
      period,
      bookingStats,
      slotUtilization,
      visitorFeedback,
      crowdTrends,
      alertHistory,
      summary: {
        totalBookings: bookingStats.reduce((sum, stat) => sum + stat.bookings, 0),
        totalVisitors: bookingStats.reduce((sum, stat) => sum + stat.visitors, 0),
        totalRevenue: bookingStats.reduce((sum, stat) => sum + stat.revenue, 0),
        avgRating: visitorFeedback.length > 0 ? 
          visitorFeedback.reduce((sum, feedback) => sum + (feedback._id * feedback.count), 0) / 
          visitorFeedback.reduce((sum, feedback) => sum + feedback.count, 0) : 0,
        utilizationRate: slotUtilization.length > 0 ?
          Math.round(slotUtilization.reduce((sum, slot) => sum + slot.avgOccupancy, 0) / slotUtilization.length * 100) : 0
      }
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Temple analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching temple analytics'
    });
  }
});

// @route   GET /api/analytics/revenue
// @desc    Get revenue analytics
// @access  Private/Admin
router.get('/revenue', protect, adminOnly, async (req, res) => {
  try {
    const { period = 'month', temple } = req.query;

    let startDate, groupBy;
    switch (period) {
      case 'week':
        startDate = moment().subtract(7, 'days').toDate();
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'month':
        startDate = moment().subtract(30, 'days').toDate();
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'year':
        startDate = moment().subtract(12, 'months').toDate();
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        startDate = moment().subtract(30, 'days').toDate();
        groupBy = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    let matchQuery = {
      createdAt: { $gte: startDate },
      paymentStatus: 'completed',
      status: { $ne: 'cancelled' }
    };

    if (temple) {
      matchQuery.temple = mongoose.Types.ObjectId(temple);
    }

    // Revenue trends
    const revenueTrends = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalAmount' },
          bookings: { $sum: 1 },
          visitors: { $sum: '$visitorsCount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Revenue by temple
    const revenueByTemple = await Booking.aggregate([
      { $match: matchQuery },
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
      },
      { $sort: { revenue: -1 } }
    ]);

    // Payment method analysis
    const paymentMethods = await Booking.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$paymentDetails.paymentMethod',
          revenue: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const analytics = {
      period,
      revenueTrends,
      revenueByTemple,
      paymentMethods,
      summary: {
        totalRevenue: revenueTrends.reduce((sum, trend) => sum + trend.revenue, 0),
        totalBookings: revenueTrends.reduce((sum, trend) => sum + trend.bookings, 0),
        avgRevenuePerBooking: revenueTrends.length > 0 ?
          Math.round(revenueTrends.reduce((sum, trend) => sum + trend.revenue, 0) / 
          revenueTrends.reduce((sum, trend) => sum + trend.bookings, 0)) : 0,
        growthRate: calculateGrowthRate(revenueTrends)
      }
    };

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    console.error('Revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching revenue analytics'
    });
  }
});

// @route   GET /api/analytics/export
// @desc    Export analytics data
// @access  Private/Admin
router.get('/export', protect, adminOnly, async (req, res) => {
  try {
    const { type = 'bookings', format = 'json', startDate, endDate } = req.query;

    const start = startDate ? moment(startDate).startOf('day').toDate() : moment().subtract(30, 'days').toDate();
    const end = endDate ? moment(endDate).endOf('day').toDate() : moment().endOf('day').toDate();

    let data;

    switch (type) {
      case 'bookings':
        data = await Booking.find({
          createdAt: { $gte: start, $lte: end }
        })
        .populate('temple', 'name location')
        .populate('user', 'name email phone')
        .populate('slot', 'date startTime endTime')
        .lean();
        break;

      case 'revenue':
        data = await Booking.aggregate([
          {
            $match: {
              createdAt: { $gte: start, $lte: end },
              paymentStatus: 'completed'
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
              bookingId: 1,
              templeName: '$temple.name',
              visitorsCount: 1,
              totalAmount: 1,
              createdAt: 1,
              status: 1
            }
          }
        ]);
        break;

      case 'crowd':
        data = await CrowdSimulation.find({
          date: { $gte: start, $lte: end }
        })
        .populate('temple', 'name location')
        .lean();
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csv = convertToCSV(data);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${type}_export_${moment().format('YYYY-MM-DD')}.csv`);
      res.send(csv);
    } else {
      res.json({
        success: true,
        data,
        exportInfo: {
          type,
          format,
          startDate: start,
          endDate: end,
          recordCount: data.length
        }
      });
    }

  } catch (error) {
    console.error('Export analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while exporting analytics data'
    });
  }
});

// Helper functions
function calculateGrowthRate(trends) {
  if (trends.length < 2) return 0;
  
  const firstPeriod = trends[0].revenue;
  const lastPeriod = trends[trends.length - 1].revenue;
  
  if (firstPeriod === 0) return 0;
  
  return Math.round(((lastPeriod - firstPeriod) / firstPeriod) * 100);
}

function convertToCSV(data) {
  if (!data.length) return '';
  
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => 
    Object.values(row).map(value => 
      typeof value === 'string' ? `"${value}"` : value
    ).join(',')
  );
  
  return [headers, ...rows].join('\n');
}

module.exports = router;
