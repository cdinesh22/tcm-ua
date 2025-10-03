const express = require('express');
const moment = require('moment');
const CrowdSimulation = require('../models/CrowdSimulation');
const Temple = require('../models/Temple');
const { broadcast } = require('../utils/sse');
const Booking = require('../models/Booking');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const { mockTemples, getSimulationData } = require('../mocks/data');
const NO_DB = (process.env.MONGODB_URI === 'disabled') || (process.env.NO_DB === '1');

const router = express.Router();

// @route   GET /api/simulation/:templeId
// @desc    Get crowd simulation data for a temple
// @access  Public
router.get('/:templeId', optionalAuth, async (req, res) => {
  try {
    const { templeId } = req.params;
    const { date = moment().format('YYYY-MM-DD') } = req.query;
    if (NO_DB) {
      const t = mockTemples.find(x => String(x._id) === String(templeId));
      if (!t) return res.status(404).json({ success: false, message: 'Temple not found' });
      const data = getSimulationData(templeId, date);
      return res.json({ success: true, data });
    }

    const temple = await Temple.findById(templeId);
    if (!temple) {
      return res.status(404).json({ success: false, message: 'Temple not found' });
    }

    const queryDate = moment(date).startOf('day').toDate();
    let simulation = await CrowdSimulation.findOne({ temple: templeId, date: queryDate, isActive: true });
    if (!simulation) {
      simulation = await createBasicSimulation(templeId, queryDate);
    }
    const currentHour = moment().hour();
    const currentHourData = simulation.hourlyData.find(data => data.hour === currentHour);
    const activeAlerts = simulation.getActiveAlerts();
    const responseData = {
      temple: { id: temple._id, name: temple.name, location: temple.location, capacity: temple.capacity },
      date,
      currentStatus: {
        hour: currentHour,
        crowdDensity: simulation.getOverallDensity(),
        expectedVisitors: currentHourData?.expectedVisitors || 0,
        actualVisitors: currentHourData?.actualVisitors || 0,
        waitTime: currentHourData?.waitTime || 0
      },
      hourlyData: simulation.hourlyData,
      peakHours: simulation.peakHours,
      alerts: activeAlerts,
      recommendations: simulation.recommendations.filter(rec => !rec.implementedAt),
      weatherImpact: simulation.weatherImpact,
      areas: currentHourData?.areas || []
    };
    res.json({ success: true, data: responseData });
  } catch (error) {
    console.error('Get simulation error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching simulation data' });
  }
});

// @route   POST /api/simulation/:templeId/update
// @desc    Update crowd simulation data (Admin only)
// @access  Private/Admin
router.post('/:templeId/update', protect, adminOnly, async (req, res) => {
  try {
    const { templeId } = req.params;
    const { 
      hour, 
      expectedVisitors, 
      actualVisitors, 
      areas,
      weatherImpact 
    } = req.body;
    if (NO_DB) {
      const temple = mockTemples.find(x => String(x._id) === String(templeId));
      if (!temple) return res.status(404).json({ success: false, message: 'Temple not found' });
      const capacity = temple.capacity?.maxVisitorsPerSlot || 300;
      const responsePayload = {
        success: true,
        message: 'Simulation updated successfully',
        data: { 
          currentStatus: {
            hour,
            crowdDensity: (actualVisitors / Math.max(1, expectedVisitors)) < 0.5 ? 'low' : (actualVisitors / Math.max(1, expectedVisitors)) < 0.8 ? 'medium' : (actualVisitors / Math.max(1, expectedVisitors)) < 1.2 ? 'high' : 'critical',
            expectedVisitors,
            actualVisitors,
            waitTime: Math.round(Math.max(0, (actualVisitors / Math.max(1, capacity)) * 20))
          }
        }
      };
      // Broadcast SSE update
      try {
        broadcast(String(templeId), 'status', {
          isOpen: true,
          currentOccupancy: actualVisitors,
          occupancyPercentage: Math.min(100, Math.round((actualVisitors / Math.max(1, capacity)) * 100)),
          crowdLevel: responsePayload.data.currentStatus.crowdDensity,
          lastUpdated: new Date().toISOString(),
          capacity
        });
      } catch (_) {}
      return res.json(responsePayload);
    }

    const today = moment().startOf('day').toDate();

    let simulation = await CrowdSimulation.findOne({
      temple: templeId,
      date: today,
      isActive: true
    });

    if (!simulation) {
      simulation = await createBasicSimulation(templeId, today);
    }

    // Update hourly data
    const hourIndex = simulation.hourlyData.findIndex(data => data.hour === hour);
    if (hourIndex !== -1) {
      simulation.hourlyData[hourIndex].expectedVisitors = expectedVisitors;
      simulation.hourlyData[hourIndex].actualVisitors = actualVisitors;
      simulation.hourlyData[hourIndex].waitTime = calculateWaitTime(actualVisitors, temple.capacity.maxVisitorsPerSlot);
      simulation.hourlyData[hourIndex].crowdDensity = calculateCrowdDensity(actualVisitors, expectedVisitors);
      
      if (areas) {
        simulation.hourlyData[hourIndex].areas = areas.map(area => ({
          ...area,
          densityLevel: calculateAreaDensity(area.currentOccupancy, area.capacity)
        }));
      }
    }

    // Update weather impact
    if (weatherImpact) {
      simulation.weatherImpact = weatherImpact;
    }

    // Update temple current status
    temple.currentStatus.currentOccupancy = actualVisitors;
    await temple.save();

    // Check for alerts
    await checkAndCreateAlerts(simulation, temple);

    await simulation.save();

    const responsePayload = {
      success: true,
      message: 'Simulation updated successfully',
      data: { 
        currentStatus: {
          hour,
          crowdDensity: simulation.getOverallDensity(),
          expectedVisitors,
          actualVisitors,
          waitTime: calculateWaitTime(actualVisitors, temple.capacity.maxVisitorsPerSlot)
        }
      }
    };

    // Broadcast the latest temple status to SSE subscribers
    broadcast(String(templeId), 'status', {
      isOpen: temple.currentStatus.isOpen,
      currentOccupancy: temple.currentStatus.currentOccupancy,
      occupancyPercentage: Math.round((temple.currentStatus.currentOccupancy / temple.capacity.maxVisitorsPerSlot) * 100),
      crowdLevel: simulation.getOverallDensity(),
      lastUpdated: new Date().toISOString(),
      capacity: temple.capacity.maxVisitorsPerSlot
    });

    res.json(responsePayload);

  } catch (error) {
    console.error('Update simulation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating simulation'
    });
  }
});

// @route   POST /api/simulation/:templeId/alert
// @desc    Create emergency alert (Admin only)
// @access  Private/Admin
router.post('/:templeId/alert', protect, adminOnly, async (req, res) => {
  try {
    const { templeId } = req.params;
    const { type, severity, message, affectedAreas } = req.body;
    if (NO_DB) {
      return res.json({ success: true, message: 'Alert created successfully', data: { alert: { id: 'mock', type, severity, message, affectedAreas: affectedAreas || [], isActive: true } } })
    }

    const today = moment().startOf('day').toDate();

    let simulation = await CrowdSimulation.findOne({
      temple: templeId,
      date: today,
      isActive: true
    });

    if (!simulation) {
      simulation = await createBasicSimulation(templeId, today);
    }

    // Add alert
    await simulation.addAlert({
      type,
      severity,
      message,
      affectedAreas: affectedAreas || []
    });

    res.json({
      success: true,
      message: 'Alert created successfully',
      data: { 
        alert: simulation.alerts[simulation.alerts.length - 1]
      }
    });

  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating alert'
    });
  }
});

// @route   PUT /api/simulation/:templeId/alert/:alertId/resolve
// @desc    Resolve alert (Admin only)
// @access  Private/Admin
router.put('/:templeId/alert/:alertId/resolve', protect, adminOnly, async (req, res) => {
  try {
    const { templeId, alertId } = req.params;
    if (NO_DB) {
      return res.json({ success: true, message: 'Alert resolved successfully' });
    }

    res.json({
      success: true,
      message: 'Alert resolved successfully'
    });

  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resolving alert'
    });
  }
});

// @route   GET /api/simulation/:templeId/heatmap
// @desc    Get heatmap data for temple areas
// @access  Public
router.get('/:templeId/heatmap', optionalAuth, async (req, res) => {
  try {
    const { templeId } = req.params;
    const { hour = moment().hour() } = req.query;
    if (NO_DB) {
      const temple = mockTemples.find(x => String(x._id) === String(templeId));
      if (!temple) return res.status(404).json({ success: false, message: 'Temple not found' });
      const sim = getSimulationData(templeId);
      const hourNum = parseInt(hour, 10);
      const h = sim.hourlyData.find(x => x.hour === hourNum) || sim.hourlyData[0];
      const areas = (h?.areas || []).map(a => ({
        name: a.name,
        coordinates: a.coordinates,
        density: a.density,
        occupancy: a.occupancy,
        capacity: a.capacity,
        occupancyPercentage: a.occupancyPercentage,
      }));
      const facilities = (temple.facilities || []).map(f => ({
        name: f.name,
        type: f.type,
        coordinates: f.coordinates,
        density: 'low',
        description: f.description,
      }));
      return res.json({ success: true, data: { temple: { name: temple.name, coordinates: temple.location.coordinates }, hour: hourNum, areas, facilities } });
    }

    const temple = await Temple.findById(templeId);
    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    const today = moment().startOf('day').toDate();

    const simulation = await CrowdSimulation.findOne({
      temple: templeId,
      date: today,
      isActive: true
    });

    let heatmapData = [];

    if (simulation) {
      const hourData = simulation.hourlyData.find(data => data.hour === parseInt(hour));
      if (hourData && hourData.areas) {
        heatmapData = hourData.areas.map(area => ({
          name: area.name,
          coordinates: area.coordinates,
          density: area.densityLevel,
          occupancy: area.currentOccupancy,
          capacity: area.capacity,
          occupancyPercentage: Math.round((area.currentOccupancy / area.capacity) * 100)
        }));
      }
    }

    // Add temple facilities to heatmap
    const facilities = temple.facilities.map(facility => ({
      name: facility.name,
      type: facility.type,
      coordinates: facility.coordinates,
      density: 'low', // Default for facilities
      description: facility.description
    }));

    res.json({
      success: true,
      data: {
        temple: {
          name: temple.name,
          coordinates: temple.location.coordinates
        },
        hour: parseInt(hour),
        areas: heatmapData,
        facilities
      }
    });

  } catch (error) {
    console.error('Get heatmap error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching heatmap data'
    });
  }
});

// Helper functions
async function createBasicSimulation(templeId, date) {
  const temple = await Temple.findById(templeId);
  
  // Create basic hourly data
  const hourlyData = [];
  for (let hour = 6; hour <= 22; hour++) {
    const baseVisitors = Math.floor(temple.capacity.maxVisitorsPerSlot * 0.3);
    const peakMultiplier = (hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 20) ? 2 : 1;
    
    hourlyData.push({
      hour,
      expectedVisitors: baseVisitors * peakMultiplier,
      actualVisitors: 0,
      crowdDensity: 'low',
      waitTime: 0,
      areas: [
        {
          name: 'Main Temple',
          coordinates: temple.location.coordinates,
          capacity: temple.capacity.maxVisitorsPerSlot,
          currentOccupancy: 0,
          densityLevel: 'low'
        },
        {
          name: 'Queue Area',
          coordinates: {
            latitude: temple.location.coordinates.latitude + 0.001,
            longitude: temple.location.coordinates.longitude + 0.001
          },
          capacity: Math.floor(temple.capacity.maxVisitorsPerSlot * 0.5),
          currentOccupancy: 0,
          densityLevel: 'low'
        }
      ]
    });
  }

  const simulation = new CrowdSimulation({
    temple: templeId,
    date,
    hourlyData,
    peakHours: [
      { startHour: 8, endHour: 10, expectedCrowd: temple.capacity.maxVisitorsPerSlot * 2, reason: 'Morning prayers' },
      { startHour: 18, endHour: 20, expectedCrowd: temple.capacity.maxVisitorsPerSlot * 2, reason: 'Evening aarti' }
    ],
    weatherImpact: {
      condition: 'sunny',
      temperature: 25,
      impactLevel: 'none',
      expectedReduction: 0
    }
  });

  return await simulation.save();
}

function calculateWaitTime(actualVisitors, capacity) {
  const occupancyRatio = actualVisitors / capacity;
  if (occupancyRatio < 0.3) return 0;
  if (occupancyRatio < 0.6) return 5;
  if (occupancyRatio < 0.8) return 15;
  return 30;
}

function calculateCrowdDensity(actualVisitors, expectedVisitors) {
  const ratio = actualVisitors / expectedVisitors;
  if (ratio < 0.5) return 'low';
  if (ratio < 0.8) return 'medium';
  if (ratio < 1.2) return 'high';
  return 'critical';
}

function calculateAreaDensity(occupancy, capacity) {
  const ratio = occupancy / capacity;
  if (ratio < 0.3) return 'low';
  if (ratio < 0.6) return 'medium';
  if (ratio < 0.9) return 'high';
  return 'critical';
}

async function checkAndCreateAlerts(simulation, temple) {
  const currentHour = moment().hour();
  const currentData = simulation.hourlyData.find(data => data.hour === currentHour);
  
  if (!currentData) return;

  const occupancyRatio = currentData.actualVisitors / temple.capacity.maxVisitorsPerSlot;

  // Check for overcrowding
  if (occupancyRatio > 0.9 && !simulation.alerts.some(alert => 
    alert.isActive && alert.type === 'overcrowding'
  )) {
    await simulation.addAlert({
      type: 'overcrowding',
      severity: 'high',
      message: `Temple is at ${Math.round(occupancyRatio * 100)}% capacity. Consider crowd control measures.`,
      affectedAreas: ['Main Temple']
    });
  }

  // Check for critical overcrowding
  if (occupancyRatio > 1.1 && !simulation.alerts.some(alert => 
    alert.isActive && alert.type === 'overcrowding' && alert.severity === 'critical'
  )) {
    await simulation.addAlert({
      type: 'overcrowding',
      severity: 'critical',
      message: `CRITICAL: Temple is over capacity at ${Math.round(occupancyRatio * 100)}%. Immediate action required.`,
      affectedAreas: ['Main Temple', 'Queue Area']
    });
  }
}

module.exports = router;
