import { supabase, getUserFromToken, verifyAdminRole, createResponse, createErrorResponse } from '../utils/supabase.js'
import QRCode from 'qrcode'

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
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

      const { page = 1, limit = 10, status, temple_id } = req.query
      const isAdmin = await verifyAdminRole(user.id)

      let query = supabase
        .from('bookings')
        .select(`
          *,
          temple:temples(name, city, state),
          slot:slots(date, start_time, end_time),
          user:users(name, email, phone)
        `)

      // If not admin, only show user's own bookings
      if (!isAdmin) {
        query = query.eq('user_id', user.id)
      }

      // Apply filters
      if (status) {
        query = query.eq('status', status)
      }
      if (temple_id) {
        query = query.eq('temple_id', temple_id)
      }

      // Apply pagination
      const offset = (page - 1) * limit
      query = query.range(offset, offset + limit - 1).order('created_at', { ascending: false })

      const { data: bookings, error } = await query

      if (error) {
        console.error('Bookings fetch error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to fetch bookings'
        })
      }

      // Get total count for pagination
      let countQuery = supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })

      if (!isAdmin) {
        countQuery = countQuery.eq('user_id', user.id)
      }
      if (status) {
        countQuery = countQuery.eq('status', status)
      }
      if (temple_id) {
        countQuery = countQuery.eq('temple_id', temple_id)
      }

      const { count } = await countQuery

      res.json({
        success: true,
        data: {
          bookings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      })

    } catch (error) {
      console.error('Get bookings error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while fetching bookings'
      })
    }
  } else if (req.method === 'POST') {
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

      const {
        temple_id,
        slot_id,
        visitors_count,
        visitors,
        contact_email,
        contact_phone,
        total_amount,
        payment_method = 'online',
        special_requests = []
      } = req.body

      // Validate required fields
      if (!temple_id || !slot_id || !visitors_count || !visitors || !contact_email || !contact_phone || !total_amount) {
        return res.status(400).json({
          success: false,
          message: 'All required fields must be provided'
        })
      }

      // Validate visitors count
      if (visitors_count < 1 || visitors_count > 10) {
        return res.status(400).json({
          success: false,
          message: 'Visitors count must be between 1 and 10'
        })
      }

      // Validate visitors array
      if (!Array.isArray(visitors) || visitors.length !== visitors_count) {
        return res.status(400).json({
          success: false,
          message: 'Visitors array must match visitors count'
        })
      }

      // Check if slot is available
      const { data: slot, error: slotError } = await supabase
        .from('slots')
        .select('*')
        .eq('id', slot_id)
        .eq('is_available', true)
        .single()

      if (slotError || !slot) {
        return res.status(400).json({
          success: false,
          message: 'Selected slot is not available'
        })
      }

      // Check if slot has enough capacity
      if (slot.current_bookings + visitors_count > slot.max_capacity) {
        return res.status(400).json({
          success: false,
          message: 'Not enough capacity in the selected slot'
        })
      }

      // Generate QR code
      const bookingId = `TCM${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`.toUpperCase()
      const qrCodeData = {
        bookingId,
        templeId: temple_id,
        slotId: slot_id,
        userId: user.id,
        visitorsCount: visitors_count
      }

      const qrCode = await QRCode.toDataURL(JSON.stringify(qrCodeData))

      // Create booking
      const { data: booking, error } = await supabase
        .from('bookings')
        .insert({
          booking_id: bookingId,
          user_id: user.id,
          temple_id,
          slot_id,
          visitors_count,
          visitors,
          contact_email,
          contact_phone,
          total_amount: parseFloat(total_amount),
          payment_status: 'completed',
          payment_method,
          qr_code: qrCode,
          special_requests
        })
        .select(`
          *,
          temple:temples(name, city, state),
          slot:slots(date, start_time, end_time)
        `)
        .single()

      if (error) {
        console.error('Booking creation error:', error)
        return res.status(500).json({
          success: false,
          message: 'Failed to create booking'
        })
      }

      res.status(201).json({
        success: true,
        message: 'Booking created successfully',
        data: { booking }
      })

    } catch (error) {
      console.error('Create booking error:', error)
      res.status(500).json({
        success: false,
        message: 'Server error while creating booking'
      })
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' })
  }
}
