const express = require('express')
const router = express.Router()

// Simple queueing-theory inspired estimator
// Inputs: currentVisitors, capacityPerSlot, slotDurationMinutes, lanes(optional)
// Assumption: service rate = (capacityPerSlot / slotDurationMinutes) * lanes (visitors per minute)
// Waiting time (minutes) ≈ max(0, currentVisitors / serviceRate)
function estimateWait({ currentVisitors = 0, capacityPerSlot = 0, slotDurationMinutes = 30, lanes = 2 }) {
  currentVisitors = Number(currentVisitors) || 0
  capacityPerSlot = Number(capacityPerSlot) || 0
  slotDurationMinutes = Math.max(1, Number(slotDurationMinutes) || 30)
  lanes = Math.max(1, Number(lanes) || 2)
  const serviceRate = capacityPerSlot > 0 ? (capacityPerSlot / slotDurationMinutes) * lanes : 0
  const minutes = serviceRate > 0 ? Math.max(0, Math.round(currentVisitors / serviceRate)) : null
  let level = 'low'
  if (minutes == null) level = 'unknown'
  else if (minutes > 90) level = 'high'
  else if (minutes > 45) level = 'medium'
  else level = 'low'
  return { minutes, level }
}

// POST /api/waiting-times/estimate
router.post('/estimate', (req, res) => {
  try {
    const { currentVisitors, capacityPerSlot, slotDurationMinutes, lanes } = req.body || {}
    const out = estimateWait({ currentVisitors, capacityPerSlot, slotDurationMinutes, lanes })
    return res.json({ data: out })
  } catch (e) {
    return res.status(400).json({ message: 'Bad request' })
  }
})

module.exports = router
