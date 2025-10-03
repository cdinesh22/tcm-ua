// In-memory mock data for no-DB mode

const mockTemples = [
  {
    _id: 't1',
    name: 'Shree Mandir',
    isActive: true,
    description: 'Historic temple for demo.',
    location: {
      city: 'Puri',
      state: 'Odisha',
      coordinates: { latitude: 19.8045, longitude: 85.8174 },
    },
    timings: { openTime: '06:00', closeTime: '22:00', slotDuration: 30 },
    capacity: { maxVisitorsPerSlot: 500, totalDailyCapacity: 10000 },
    facilities: [
      { name: 'Drinking Water', type: 'amenity', coordinates: { latitude: 19.805, longitude: 85.8178 } },
      { name: 'Restroom', type: 'restroom', coordinates: { latitude: 19.8049, longitude: 85.8176 } },
      { name: 'Medical Aid', type: 'medical', coordinates: { latitude: 19.8047, longitude: 85.8172 } },
    ],
    images: [
      { url: 'https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=1200&auto=format&fit=crop', caption: 'Temple facade' },
    ],
    rules: ['No photography in sanctum', 'Maintain silence', 'Queue discipline'],
    emergencyContacts: [ { name: 'Control Room', phone: '+91-11111 11111' } ],
    externalSources: { websiteUrl: 'https://example.com' },
  },
  {
    _id: 't2',
    name: 'Mahadev Temple',
    isActive: true,
    location: {
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      coordinates: { latitude: 25.3176, longitude: 82.9739 },
    },
    timings: { openTime: '05:30', closeTime: '21:30', slotDuration: 30 },
    capacity: { maxVisitorsPerSlot: 400, totalDailyCapacity: 8000 },
    facilities: [
      { name: 'Parking', type: 'parking', coordinates: { latitude: 25.318, longitude: 82.9744 } },
    ],
    images: [],
    rules: ['Footwear outside'],
    emergencyContacts: [],
    externalSources: {},
  },
]

function buildHourlyData(temple) {
  const data = []
  const cap = temple.capacity?.maxVisitorsPerSlot || 300
  for (let hour = 6; hour <= 22; hour++) {
    const peak = (hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 20)
    const expected = Math.round(cap * (peak ? 1.6 : 0.7))
    const actual = Math.max(0, Math.round(expected * (0.8 + Math.random() * 0.5)))
    const queueCap = Math.round(cap * 0.5)
    const occPct = Math.min(100, Math.round((actual / cap) * 100))
    const density = occPct > 90 ? 'critical' : occPct > 70 ? 'high' : occPct > 40 ? 'medium' : 'low'
    data.push({
      hour,
      expectedVisitors: expected,
      actualVisitors: actual,
      crowdDensity: density,
      waitTime: occPct > 80 ? 25 : occPct > 60 ? 15 : occPct > 30 ? 5 : 0,
      areas: [
        {
          name: 'Main Temple',
          coordinates: temple.location.coordinates,
          capacity: cap,
          occupancy: Math.min(cap, actual),
          occupancyPercentage: occPct,
          density,
        },
        {
          name: 'Queue Area',
          coordinates: {
            latitude: temple.location.coordinates.latitude + 0.001,
            longitude: temple.location.coordinates.longitude + 0.001,
          },
          capacity: queueCap,
          occupancy: Math.min(queueCap, Math.round(actual * 0.5)),
          occupancyPercentage: Math.min(100, Math.round((Math.round(actual * 0.5) / queueCap) * 100)),
          density,
        },
      ],
    })
  }
  return data
}

function getSimulationData(templeId, dateStr) {
  const temple = mockTemples.find(t => String(t._id) === String(templeId))
  if (!temple) return null
  const hourlyData = buildHourlyData(temple)
  const now = new Date()
  const hour = now.getHours()
  const current = hourlyData.find(h => h.hour === hour) || hourlyData[0]
  return {
    temple: {
      id: temple._id,
      name: temple.name,
      location: temple.location,
      capacity: temple.capacity,
    },
    date: dateStr || new Date().toISOString().split('T')[0],
    currentStatus: {
      hour: current.hour,
      crowdDensity: current.crowdDensity,
      expectedVisitors: current.expectedVisitors,
      actualVisitors: current.actualVisitors,
      waitTime: current.waitTime,
    },
    hourlyData,
    peakHours: [ { startHour: 8, endHour: 10 }, { startHour: 18, endHour: 20 } ],
    alerts: [],
    recommendations: [],
    weatherImpact: { condition: 'sunny', temperature: 28, impactLevel: 'none' },
    areas: current.areas,
    facilities: temple.facilities || [],
  }
}

module.exports = { mockTemples, getSimulationData }
