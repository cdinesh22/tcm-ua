import { supabase, getUserFromToken, createResponse, createErrorResponse } from '../utils/supabase.js'

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    // Get authorization header
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

    // Get user profile with booking history
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select(`
        *,
        bookings:bookings(
          id,
          booking_id,
          status,
          visitors_count,
          total_amount,
          created_at,
          temple:temples(name),
          slot:slots(date, start_time, end_time)
        )
      `)
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Profile fetch error:', profileError)
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch user profile'
      })
    }

    res.json({
      success: true,
      data: {
        user: userProfile
      }
    })

  } catch (error) {
    console.error('Get profile error:', error)
    res.status(500).json({
      success: false,
      message: 'Server error while fetching profile'
    })
  }
}
