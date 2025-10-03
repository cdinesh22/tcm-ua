const { supabase, getUserFromToken, verifyAdminRole, createResponse, createErrorResponse } = require('../utils/supabase.js')

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    try {
      const { page = 1, limit = 10, search, city, state } = req.query

      let query = supabase
        .from('temples')
        .select('*')
        .eq('is_active', true)
        .order('name')

      // Apply filters
      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }
      if (city) {
        query = query.eq('city', city)
      }
      if (state) {
        query = query.eq('state', state)
      }

      // Apply pagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1)

      const { data: temples, error } = await query

      if (error) {
        console.error('Temples fetch error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch temples'
        })
      }

      // Get total count for pagination
      let countQuery = supabase
        .from('temples')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)

      if (search) {
        countQuery = countQuery.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
      }
      if (city) {
        countQuery = countQuery.eq('city', city)
      }
      if (state) {
        countQuery = countQuery.eq('state', state)
      }

      const { count } = await countQuery

      res.json({
        success: true,
        data: {
          temples,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      })

    } catch (error) {
      console.error('Get temples error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while fetching temples'
      })
    }
  } else if (req.method === 'POST') {
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

      const {
        name,
        city,
        state,
        latitude,
        longitude,
        address,
        description,
        max_visitors_per_slot,
        total_daily_capacity,
        open_time,
        close_time,
        slot_duration = 30,
        break_times = [],
        facilities = [],
        rules = [],
        emergency_contacts = [],
        website_url,
        rss_feeds = []
      } = req.body

      // Validate required fields
      if (!name || !city || !state || !latitude || !longitude || !address || !description || !max_visitors_per_slot || !total_daily_capacity || !open_time || !close_time) {
        return res.status(400).json({
          success: false,
          message: 'All required fields must be provided'
        })
      }

      const { data: temple, error } = await supabase
        .from('temples')
        .insert({
          name,
          city,
          state,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          address,
          description,
          max_visitors_per_slot: parseInt(max_visitors_per_slot),
          total_daily_capacity: parseInt(total_daily_capacity),
          open_time,
          close_time,
          slot_duration: parseInt(slot_duration),
          break_times,
          facilities,
          rules,
          emergency_contacts,
          website_url,
          rss_feeds
        })
        .select()
        .single()

      if (error) {
        console.error('Temple creation error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to create temple'
        })
      }

      res.status(201).json({
        success: true,
        message: 'Temple created successfully',
        data: { temple }
      })

    } catch (error) {
      console.error('Create temple error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while creating temple'
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
