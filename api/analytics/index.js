const { supabase, getUserFromToken, verifyAdminRole, createResponse, createErrorResponse } = require('../utils/supabase.js')

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Check if user is authenticated and is admin
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      })
    }

    const token = authHeader.split(' ')[1]
    const user = await getUserFromToken(token)

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      })
    }

    const isAdmin = await verifyAdminRole(user.id)
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      })
    }

    const { period = '7d', temple_id } = req.query

    // Calculate date range based on period
    const now = new Date()
    let startDate
    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // Get overall statistics
    const { data: totalBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString())

    if (bookingsError) {
      console.error('Bookings count error:', bookingsError)
    }

    const { data: totalUsers, error: usersError } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', startDate.toISOString())

    if (usersError) {
      console.error('Users count error:', usersError)
    }

    const { data: totalTemples, error: templesError } = await supabase
      .from('temples')
      .select('*', { count: 'exact' })
      .eq('is_active', true)

    if (templesError) {
      console.error('Temples count error:', templesError)
    }

    // Get booking status breakdown
    const { data: bookingStatus, error: statusError } = await supabase
      .from('bookings')
      .select('status')
      .gte('created_at', startDate.toISOString())

    if (statusError) {
      console.error('Booking status error:', statusError)
    }

    const statusBreakdown = bookingStatus?.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1
      return acc
    }, {}) || {}

    // Get revenue data
    const { data: revenueData, error: revenueError } = await supabase
      .from('bookings')
      .select('total_amount, created_at')
      .eq('payment_status', 'completed')
      .gte('created_at', startDate.toISOString())

    if (revenueError) {
      console.error('Revenue data error:', revenueError)
    }

    const totalRevenue = revenueData?.reduce((sum, booking) => sum + parseFloat(booking.total_amount || 0), 0) || 0

    // Get daily booking trends
    const { data: dailyBookings, error: dailyError } = await supabase
      .from('bookings')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at')

    if (dailyError) {
      console.error('Daily bookings error:', dailyError)
    }

    // Process daily trends
    const dailyTrends = {}
    dailyBookings?.forEach(booking => {
      const date = new Date(booking.created_at).toISOString().split('T')[0]
      dailyTrends[date] = (dailyTrends[date] || 0) + 1
    })

    // Get temple-wise statistics
    let templeStats = []
    if (!temple_id) {
      const { data: templeBookings, error: templeBookingsError } = await supabase
        .from('bookings')
        .select(`
          temple_id,
          total_amount,
          temple:temples(name, city, state)
        `)
        .gte('created_at', startDate.toISOString())

      if (templeBookingsError) {
        console.error('Temple bookings error:', templeBookingsError)
      }

      // Process temple statistics
      const templeStatsMap = {}
      templeBookings?.forEach(booking => {
        const templeId = booking.temple_id
        if (!templeStatsMap[templeId]) {
          templeStatsMap[templeId] = {
            temple_id: templeId,
            temple_name: booking.temple.name,
            temple_city: booking.temple.city,
            temple_state: booking.temple.state,
            bookings_count: 0,
            revenue: 0
          }
        }
        templeStatsMap[templeId].bookings_count++
        templeStatsMap[templeId].revenue += parseFloat(booking.total_amount || 0)
      })

      templeStats = Object.values(templeStatsMap).sort((a, b) => b.bookings_count - a.bookings_count)
    }

    // Get user registration trends
    const { data: userRegistrations, error: userRegError } = await supabase
      .from('users')
      .select('created_at')
      .gte('created_at', startDate.toISOString())
      .order('created_at')

    if (userRegError) {
      console.error('User registrations error:', userRegError)
    }

    const userTrends = {}
    userRegistrations?.forEach(user => {
      const date = new Date(user.created_at).toISOString().split('T')[0]
      userTrends[date] = (userTrends[date] || 0) + 1
    })

    res.json({
      success: true,
      data: {
        overview: {
          total_bookings: totalBookings?.length || 0,
          total_users: totalUsers?.length || 0,
          total_temples: totalTemples?.length || 0,
          total_revenue: totalRevenue
        },
        booking_status: statusBreakdown,
        daily_trends: dailyTrends,
        user_trends: userTrends,
        temple_stats: templeStats,
        period,
        date_range: {
          start: startDate.toISOString(),
          end: now.toISOString()
        }
      }
    })

  } catch (error) {
    console.error('Analytics error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while fetching analytics'
    })
  }
}
