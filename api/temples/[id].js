const { supabase, getUserFromToken, verifyAdminRole, createResponse, createErrorResponse } = require('../utils/supabase.js')

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { id } = req.query

  if (!id) {
    return res.status(400).json({
      success: false,
      message: 'Temple ID is required'
    })
  }

  if (req.method === 'GET') {
    try {
      const { data: temple, error } = await supabase
        .from('temples')
        .select('*')
        .eq('id', id)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('Temple fetch error:', error)
        return res.status(404).json({
          success: false,
          message: 'Temple not found'
        })
      }

      // Get available slots for the next 7 days
      const { data: slots, error: slotsError } = await supabase
        .from('slots')
        .select('*')
        .eq('temple_id', id)
        .eq('is_available', true)
        .gte('date', new Date().toISOString().split('T')[0])
        .lte('date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date')
        .order('start_time')

      if (slotsError) {
        console.error('Slots fetch error:', slotsError)
      }

      res.json({
        success: true,
        data: {
          temple,
          slots: slots || []
        }
      })

    } catch (error) {
      console.error('Get temple error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while fetching temple'
      })
    }
  } else if (req.method === 'PUT') {
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
        slot_duration,
        break_times,
        facilities,
        rules,
        emergency_contacts,
        website_url,
        rss_feeds,
        is_open,
        is_active
      } = req.body

      const updateData = {}

      // Only update provided fields
      if (name !== undefined) updateData.name = name
      if (city !== undefined) updateData.city = city
      if (state !== undefined) updateData.state = state
      if (latitude !== undefined) updateData.latitude = parseFloat(latitude)
      if (longitude !== undefined) updateData.longitude = parseFloat(longitude)
      if (address !== undefined) updateData.address = address
      if (description !== undefined) updateData.description = description
      if (max_visitors_per_slot !== undefined) updateData.max_visitors_per_slot = parseInt(max_visitors_per_slot)
      if (total_daily_capacity !== undefined) updateData.total_daily_capacity = parseInt(total_daily_capacity)
      if (open_time !== undefined) updateData.open_time = open_time
      if (close_time !== undefined) updateData.close_time = close_time
      if (slot_duration !== undefined) updateData.slot_duration = parseInt(slot_duration)
      if (break_times !== undefined) updateData.break_times = break_times
      if (facilities !== undefined) updateData.facilities = facilities
      if (rules !== undefined) updateData.rules = rules
      if (emergency_contacts !== undefined) updateData.emergency_contacts = emergency_contacts
      if (website_url !== undefined) updateData.website_url = website_url
      if (rss_feeds !== undefined) updateData.rss_feeds = rss_feeds
      if (is_open !== undefined) updateData.is_open = is_open
      if (is_active !== undefined) updateData.is_active = is_active

      const { data: temple, error } = await supabase
        .from('temples')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('Temple update error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to update temple'
        })
      }

      res.json({
        success: true,
        message: 'Temple updated successfully',
        data: { temple }
      })

    } catch (error) {
      console.error('Update temple error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while updating temple'
      })
    }
  } else if (req.method === 'DELETE') {
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

      // Soft delete by setting is_active to false
      const { error } = await supabase
        .from('temples')
        .update({ is_active: false })
        .eq('id', id)

      if (error) {
        console.error('Temple delete error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to delete temple'
        })
      }

      res.json({
        success: true,
        message: 'Temple deleted successfully'
      })

    } catch (error) {
      console.error('Delete temple error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while deleting temple'
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
