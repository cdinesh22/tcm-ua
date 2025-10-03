import { supabase, getUserFromToken, verifyAdminRole, createResponse, createErrorResponse } from '../utils/supabase.js'

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method === 'GET') {
    try {
      const { temple_id, date, page = 1, limit = 50 } = req.query

      if (!temple_id) {
        return res.status(400).json({
          success: false,
          message: 'Temple ID is required'
        })
      }

      let query = supabase
        .from('slots')
        .select('*')
        .eq('temple_id', temple_id)
        .eq('is_available', true)

      // Filter by date if provided
      if (date) {
        query = query.eq('date', date)
      } else {
        // Default to today and future dates
        query = query.gte('date', new Date().toISOString().split('T')[0])
      }

      // Apply pagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1).order('date').order('start_time')

      const { data: slots, error } = await query

      if (error) {
        console.error('Slots fetch error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch slots'
        })
      }

      // Get total count for pagination
      let countQuery = supabase
        .from('slots')
        .select('*', { count: 'exact', head: true })
        .eq('temple_id', temple_id)
        .eq('is_available', true)

      if (date) {
        countQuery = countQuery.eq('date', date)
      } else {
        countQuery = countQuery.gte('date', new Date().toISOString().split('T')[0])
      }

      const { count } = await countQuery

      res.json({
        success: true,
        data: {
          slots,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      })

    } catch (error) {
      console.error('Get slots error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while fetching slots'
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

      const { slots } = req.body

      if (!Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Slots array is required'
        })
      }

      // Validate each slot
      for (const slot of slots) {
        if (!slot.temple_id || !slot.date || !slot.start_time || !slot.end_time || !slot.max_capacity) {
          return res.status(400).json({
            success: false,
            message: 'Each slot must have temple_id, date, start_time, end_time, and max_capacity'
          })
        }
      }

      const { data: createdSlots, error } = await supabase
        .from('slots')
        .insert(slots)
        .select()

      if (error) {
        console.error('Slots creation error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to create slots'
        })
      }

      res.status(201).json({
        success: true,
        message: 'Slots created successfully',
        data: { slots: createdSlots }
      })

    } catch (error) {
      console.error('Create slots error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while creating slots'
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
