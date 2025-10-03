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
      message: 'Booking ID is required'
    })
  }

  if (req.method === 'GET') {
    try {
      // Check if user is authenticated
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

      const { data: booking, error } = await supabase
        .from('bookings')
        .select(`
          *,
          temple:temples(name, city, state, address, description),
          slot:slots(date, start_time, end_time),
          user:users(name, email, phone)
        `)
        .eq('id', id)
        .single()

      if (error) {
        console.error('Booking fetch error:', error)
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        })
      }

      // Check if user can access this booking
      const isAdmin = await verifyAdminRole(user.id)
      if (!isAdmin && booking.user_id !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        })
      }

      res.json({
        success: true,
        data: { booking }
      })

    } catch (error) {
      console.error('Get booking error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while fetching booking'
      })
    }
  } else if (req.method === 'PUT') {
    try {
      // Check if user is authenticated
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

      // Get current booking
      const { data: currentBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !currentBooking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        })
      }

      // Check if user can modify this booking
      const isAdmin = await verifyAdminRole(user.id)
      if (!isAdmin && currentBooking.user_id !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        })
      }

      const {
        status,
        visitors_count,
        visitors,
        contact_email,
        contact_phone,
        special_requests,
        check_in_time,
        check_in_latitude,
        check_in_longitude,
        check_in_verified_by,
        check_out_time,
        feedback_rating,
        feedback_comment
      } = req.body

      const updateData = {}

      // Only update provided fields
      if (status !== undefined) updateData.status = status
      if (visitors_count !== undefined) updateData.visitors_count = visitors_count
      if (visitors !== undefined) updateData.visitors = visitors
      if (contact_email !== undefined) updateData.contact_email = contact_email
      if (contact_phone !== undefined) updateData.contact_phone = contact_phone
      if (special_requests !== undefined) updateData.special_requests = special_requests
      if (check_in_time !== undefined) updateData.check_in_time = check_in_time
      if (check_in_latitude !== undefined) updateData.check_in_latitude = parseFloat(check_in_latitude)
      if (check_in_longitude !== undefined) updateData.check_in_longitude = parseFloat(check_in_longitude)
      if (check_in_verified_by !== undefined) updateData.check_in_verified_by = check_in_verified_by
      if (check_out_time !== undefined) updateData.check_out_time = check_out_time
      if (feedback_rating !== undefined) updateData.feedback_rating = parseInt(feedback_rating)
      if (feedback_comment !== undefined) updateData.feedback_comment = feedback_comment

      // If non-admin is trying to cancel, check if cancellation is allowed
      if (!isAdmin && status === 'cancelled') {
        // Check if booking can be cancelled (up to 2 hours before slot time)
        const slotDateTime = new Date(`${currentBooking.slot.date}T${currentBooking.slot.start_time}:00`)
        const now = new Date()
        const hoursUntilSlot = (slotDateTime - now) / (1000 * 60 * 60)

        if (hoursUntilSlot <= 2) {
          return res.status(400).json({
            success: false,
            message: 'Booking can only be cancelled up to 2 hours before the slot time'
          })
        }
      }

      const { data: booking, error } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          temple:temples(name, city, state),
          slot:slots(date, start_time, end_time)
        `)
        .single()

      if (error) {
        console.error('Booking update error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to update booking'
        })
      }

      res.json({
        success: true,
        message: 'Booking updated successfully',
        data: { booking }
      })

    } catch (error) {
      console.error('Update booking error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while updating booking'
      })
    }
  } else if (req.method === 'DELETE') {
    try {
      // Check if user is authenticated
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

      // Get current booking
      const { data: currentBooking, error: fetchError } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', id)
        .single()

      if (fetchError || !currentBooking) {
        return res.status(404).json({
          success: false,
          message: 'Booking not found'
        })
      }

      // Check if user can delete this booking
      const isAdmin = await verifyAdminRole(user.id)
      if (!isAdmin && currentBooking.user_id !== user.id) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        })
      }

      // If non-admin is trying to delete, check if deletion is allowed
      if (!isAdmin) {
        // Check if booking can be cancelled (up to 2 hours before slot time)
        const slotDateTime = new Date(`${currentBooking.slot.date}T${currentBooking.slot.start_time}:00`)
        const now = new Date()
        const hoursUntilSlot = (slotDateTime - now) / (1000 * 60 * 60)

        if (hoursUntilSlot <= 2) {
          return res.status(400).json({
            success: false,
            message: 'Booking can only be cancelled up to 2 hours before the slot time'
          })
        }
      }

      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('Booking delete error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to delete booking'
        })
      }

      res.json({
        success: true,
        message: 'Booking deleted successfully'
      })

    } catch (error) {
      console.error('Delete booking error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while deleting booking'
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
