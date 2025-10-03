const express = require('express');
const Temple = require('../models/Temple');
const { protect, adminOnly, optionalAuth } = require('../middleware/auth');
const { addClient, removeClient, broadcast } = require('../utils/sse');
let getRealtimeInfo
try {
  ({ getRealtimeInfo } = require('../utils/external/templeInfoService'))
} catch (_) {
  // optional dependency; not needed in NO_DB mode
  getRealtimeInfo = async () => ({})
}
const { mockTemples, getSimulationData } = require('../mocks/data');
const NO_DB = (process.env.MONGODB_URI === 'disabled') || (process.env.NO_DB === '1');

const router = express.Router();

// @route   GET /api/temples
// @desc    Get all temples
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { search, city, state } = req.query;
    if (NO_DB) {
      const term = (search || '').toString().trim().toLowerCase();
      const cityQ = (city || '').toString().trim().toLowerCase();
      const stateQ = (state || '').toString().trim().toLowerCase();
      let list = mockTemples.filter(t => t.isActive !== false)
      if (term) {
        list = list.filter(t =>
          (t.name || '').toLowerCase().includes(term) ||
          (t.description || '').toLowerCase().includes(term)
        )
      }
      if (cityQ) list = list.filter(t => (t.location?.city || '').toLowerCase().includes(cityQ))
      if (stateQ) list = list.filter(t => (t.location?.state || '').toLowerCase().includes(stateQ))
      list = list.slice().sort((a,b)=> (a.name||'').localeCompare(b.name||''))
      return res.json({ success: true, count: list.length, data: { temples: list } })
    }

    let query = { isActive: true };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (city) query['location.city'] = { $regex: city, $options: 'i' };
    if (state) query['location.state'] = { $regex: state, $options: 'i' };

    const temples = await Temple.find(query).select('-__v').sort({ name: 1 });
    res.json({ success: true, count: temples.length, data: { temples } });

  } catch (error) {
    console.error('Get temples error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching temples' });
  }
});

// @route   GET /api/temples/:id/stream
// @desc    Server-Sent Events stream for real-time temple updates
// @access  Public
router.get('/:id/stream', async (req, res) => {
  // Setup headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const templeId = String(req.params.id);

  // Send a comment to establish the stream and a heartbeat every 25s
  res.write(': connected\n\n');
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_) { /* ignore */ }
  }, 25000);

  addClient(templeId, res);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeClient(templeId, res);
    try { res.end(); } catch (_) { /* ignore */ }
  });
});

// @route   GET /api/temples/:id/realtime
// @desc    Get real-time aggregated info (timings, notices, crowd snapshot)
// @access  Public
router.get('/:id/realtime', async (req, res) => {
  try {
    if (NO_DB) {
      const temple = mockTemples.find(t => String(t._id) === String(req.params.id) && t.isActive !== false)
      if (!temple) return res.status(404).json({ success: false, message: 'Temple not found' })
      const sim = getSimulationData(temple._id)
      const realtime = {
        timings: temple.timings,
        notices: [],
        snapshot: {
          expectedVisitors: sim.currentStatus.expectedVisitors,
          actualVisitors: sim.currentStatus.actualVisitors,
          crowdDensity: sim.currentStatus.crowdDensity,
        },
      }
      return res.json({ success: true, data: realtime })
    }

    const temple = await Temple.findById(req.params.id);
    if (!temple || !temple.isActive) {
      return res.status(404).json({ success: false, message: 'Temple not found' });
    }
    const realtime = await getRealtimeInfo(temple);
    return res.json({ success: true, data: realtime });
  } catch (error) {
    console.error('Get realtime temple info error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching real-time temple info'
    });
  }
});

// @route   GET /api/temples/:id
// @desc    Get single temple by ID
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    if (NO_DB) {
      const temple = mockTemples.find(t => String(t._id) === String(req.params.id) && t.isActive !== false)
      if (!temple) return res.status(404).json({ success: false, message: 'Temple not found' })
      return res.json({ success: true, data: { temple } })
    }

    const temple = await Temple.findById(req.params.id);
    if (!temple || !temple.isActive) {
      return res.status(404).json({ success: false, message: 'Temple not found' });
    }
    res.json({ success: true, data: { temple } });
  } catch (error) {
    console.error('Get temple error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Temple not found' });
    }
    res.status(500).json({ success: false, message: 'Server error while fetching temple' });
  }
});

// @route   POST /api/temples
// @desc    Create new temple (Admin only)
// @access  Private/Admin
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const temple = await Temple.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Temple created successfully',
      data: { temple }
    });

  } catch (error) {
    console.error('Create temple error:', error);
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
      message: 'Server error while creating temple'
    });
  }
});

// @route   PUT /api/temples/:id
// @desc    Update temple (Admin only)
// @access  Private/Admin
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const temple = await Temple.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    res.json({
      success: true,
      message: 'Temple updated successfully',
      data: { temple }
    });

  } catch (error) {
    console.error('Update temple error:', error);
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
      message: 'Server error while updating temple'
    });
  }
});

// @route   DELETE /api/temples/:id
// @desc    Delete temple (Admin only)
// @access  Private/Admin
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const temple = await Temple.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    res.json({
      success: true,
      message: 'Temple deleted successfully'
    });

  } catch (error) {
    console.error('Delete temple error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting temple'
    });
  }
});

// @route   GET /api/temples/:id/status
// @desc    Get temple current status and crowd level
// @access  Public
router.get('/:id/status', async (req, res) => {
  try {
    const temple = await Temple.findById(req.params.id);

    if (!temple || !temple.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    const status = {
      isOpen: temple.currentStatus.isOpen,
      currentOccupancy: temple.currentStatus.currentOccupancy,
      occupancyPercentage: temple.occupancyPercentage,
      crowdLevel: temple.getCrowdLevel(),
      lastUpdated: temple.currentStatus.lastUpdated,
      capacity: temple.capacity.maxVisitorsPerSlot
    };

    res.json({
      success: true,
      data: { status }
    });

  } catch (error) {
    console.error('Get temple status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching temple status'
    });
  }
});

// @route   PUT /api/temples/:id/status
// @desc    Update temple status (Admin only)
// @access  Private/Admin
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { isOpen, currentOccupancy } = req.body;

    const temple = await Temple.findByIdAndUpdate(
      req.params.id,
      {
        'currentStatus.isOpen': isOpen,
        'currentStatus.currentOccupancy': currentOccupancy,
        'currentStatus.lastUpdated': new Date()
      },
      { new: true }
    );

    if (!temple) {
      return res.status(404).json({
        success: false,
        message: 'Temple not found'
      });
    }

    const responsePayload = {
      success: true,
      message: 'Temple status updated successfully',
      data: { 
        status: {
          isOpen: temple.currentStatus.isOpen,
          currentOccupancy: temple.currentStatus.currentOccupancy,
          occupancyPercentage: temple.occupancyPercentage,
          crowdLevel: temple.getCrowdLevel(),
          lastUpdated: temple.currentStatus.lastUpdated
        }
      }
    };

    // Broadcast status update to SSE subscribers
    broadcast(String(req.params.id), 'status', responsePayload.data.status);

    res.json(responsePayload);

  } catch (error) {
    console.error('Update temple status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating temple status'
    });
  }
});

module.exports = router;
