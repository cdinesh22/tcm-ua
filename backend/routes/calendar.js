const express = require('express')
const router = express.Router()

// In-memory seed data (can be moved to Mongo later)
// Fields: id, date(YYYY-MM-DD), title, temple, level(low|medium|high), description
const EVENTS = [
  { id: 'f1', date: '2025-10-02', title: 'Gandhi Jayanti (National Holiday)', temple: 'All', level: 'medium', description: 'Nationwide holiday; moderate crowds expected at popular temples.' },
  { id: 'f2', date: '2025-10-12', title: 'Navaratri Begins', temple: 'Ambaji', level: 'high', description: 'Nine nights of devotion; heavy footfall expected especially on opening and closing days.' },
  { id: 'f3', date: '2025-10-20', title: 'Navaratri (Weekend)', temple: 'Pavagadh', level: 'high', description: 'Weekend during Navaratri; peak crowds at Pavagadh temple.' },
  { id: 'f4', date: '2025-11-01', title: 'Somnath Kartik Purnima', temple: 'Somnath', level: 'high', description: 'Auspicious full moon day; large gatherings for special rituals.' },
  { id: 'f5', date: '2025-11-03', title: 'Dwarka Dev Deepawali', temple: 'Dwarka', level: 'medium', description: 'Temple lighting and special aartis; medium to high footfall.' },
  { id: 'f6', date: '2025-12-25', title: 'Christmas (National Holiday)', temple: 'All', level: 'low', description: 'General holiday; lower crowds for most temples except tourist-heavy sites.' },
  // Additional examples
  { id: 'f7', date: '2025-10-09', title: 'Navaratri Day 3', temple: 'Ambaji', level: 'medium', description: 'Ongoing festivities; medium to high crowd.' },
  { id: 'f8', date: '2025-10-23', title: 'Dussehra/Vijayadashami', temple: 'All', level: 'high', description: 'Major festival; high footfall across prominent temples.' },
]

// GET /api/calendar?temple=Somnath&year=2025&month=10
router.get('/', (req, res) => {
  const { temple, year, month } = req.query

  let list = EVENTS.slice()

  if (temple && temple !== 'All') {
    const tNorm = String(temple).trim().toLowerCase()
    list = list.filter(e => {
      const eNorm = String(e.temple || '').trim().toLowerCase()
      return eNorm === 'all' || eNorm === tNorm
    })
  }

  if (year || month) {
    const y = parseInt(year, 10)
    const m = parseInt(month, 10) // 1-12
    list = list.filter(e => {
      const [ey, em] = e.date.split('-').map(n => parseInt(n, 10))
      const byYear = Number.isFinite(y) ? ey === y : true
      const byMonth = Number.isFinite(m) ? em === m : true
      return byYear && byMonth
    })
  }

  res.json({ data: { events: list } })
})

module.exports = router
