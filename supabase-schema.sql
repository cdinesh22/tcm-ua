-- Temple Crowd Management System - Supabase Schema
-- This file contains all the database tables needed for the application

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('pilgrim', 'admin');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_method AS ENUM ('online', 'cash', 'card');
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE id_type AS ENUM ('aadhar', 'pan', 'passport', 'driving_license');
CREATE TYPE facility_type AS ENUM ('parking', 'restroom', 'food', 'medical', 'security', 'exit', 'entrance');
CREATE TYPE language_type AS ENUM ('english', 'hindi', 'gujarati');

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(15) NOT NULL,
  role user_role DEFAULT 'pilgrim',
  is_verified BOOLEAN DEFAULT true,
  language_preference language_type DEFAULT 'english',
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT true,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Temples table
CREATE TABLE public.temples (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  city VARCHAR(50) NOT NULL,
  state VARCHAR(50) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT NOT NULL,
  description TEXT NOT NULL,
  images JSONB DEFAULT '[]',
  max_visitors_per_slot INTEGER NOT NULL CHECK (max_visitors_per_slot > 0),
  total_daily_capacity INTEGER NOT NULL,
  open_time TIME NOT NULL,
  close_time TIME NOT NULL,
  slot_duration INTEGER DEFAULT 30, -- in minutes
  break_times JSONB DEFAULT '[]',
  facilities JSONB DEFAULT '[]',
  is_open BOOLEAN DEFAULT true,
  current_occupancy INTEGER DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  rules JSONB DEFAULT '[]',
  emergency_contacts JSONB DEFAULT '[]',
  website_url TEXT,
  rss_feeds JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Slots table
CREATE TABLE public.slots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  temple_id UUID REFERENCES public.temples(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INTEGER NOT NULL,
  current_bookings INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(temple_id, date, start_time)
);

-- Bookings table
CREATE TABLE public.bookings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id VARCHAR(20) NOT NULL UNIQUE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  temple_id UUID REFERENCES public.temples(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES public.slots(id) ON DELETE CASCADE NOT NULL,
  visitors_count INTEGER NOT NULL CHECK (visitors_count >= 1 AND visitors_count <= 10),
  visitors JSONB NOT NULL DEFAULT '[]',
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(15) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_status payment_status DEFAULT 'completed',
  transaction_id VARCHAR(100),
  payment_method payment_method,
  paid_at TIMESTAMP WITH TIME ZONE,
  qr_code TEXT NOT NULL,
  status booking_status DEFAULT 'confirmed',
  check_in_time TIMESTAMP WITH TIME ZONE,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_in_verified_by VARCHAR(100),
  check_out_time TIMESTAMP WITH TIME ZONE,
  feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
  feedback_comment TEXT,
  special_requests JSONB DEFAULT '[]',
  confirmation_sent BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  qr_code_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact messages table
CREATE TABLE public.contact_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  replied_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crowd simulation data table
CREATE TABLE public.crowd_simulations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  temple_id UUID REFERENCES public.temples(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  predicted_visitors INTEGER NOT NULL,
  actual_visitors INTEGER,
  weather_condition VARCHAR(50),
  special_event VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(temple_id, date, hour)
);

-- Community posts table
CREATE TABLE public.community_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  temple_id UUID REFERENCES public.temples(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  images JSONB DEFAULT '[]',
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community comments table
CREATE TABLE public.community_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Community likes table
CREATE TABLE public.community_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON public.users(id);
CREATE INDEX idx_temples_location ON public.temples(latitude, longitude);
CREATE INDEX idx_temples_active ON public.temples(is_active);
CREATE INDEX idx_slots_temple_date ON public.slots(temple_id, date);
CREATE INDEX idx_slots_available ON public.slots(is_available);
CREATE INDEX idx_bookings_user ON public.bookings(user_id, created_at DESC);
CREATE INDEX idx_bookings_temple_slot ON public.bookings(temple_id, slot_id);
CREATE INDEX idx_bookings_booking_id ON public.bookings(booking_id);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_contact_messages_unread ON public.contact_messages(is_read);
CREATE INDEX idx_crowd_simulations_temple_date ON public.crowd_simulations(temple_id, date);
CREATE INDEX idx_community_posts_temple ON public.community_posts(temple_id, created_at DESC);
CREATE INDEX idx_community_posts_user ON public.community_posts(user_id, created_at DESC);
CREATE INDEX idx_community_comments_post ON public.community_comments(post_id, created_at);
CREATE INDEX idx_community_likes_post ON public.community_likes(post_id);

-- Row Level Security (RLS) policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.temples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crowd_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Temples policies (public read, admin write)
CREATE POLICY "Anyone can view active temples" ON public.temples
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage temples" ON public.temples
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Slots policies (public read, admin write)
CREATE POLICY "Anyone can view available slots" ON public.slots
  FOR SELECT USING (is_available = true);

CREATE POLICY "Admins can manage slots" ON public.slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Bookings policies
CREATE POLICY "Users can view their own bookings" ON public.bookings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bookings" ON public.bookings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings" ON public.bookings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Contact messages policies (admin only)
CREATE POLICY "Admins can manage contact messages" ON public.contact_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Crowd simulations policies (admin only)
CREATE POLICY "Admins can manage crowd simulations" ON public.crowd_simulations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Community posts policies
CREATE POLICY "Anyone can view published posts" ON public.community_posts
  FOR SELECT USING (is_published = true);

CREATE POLICY "Authenticated users can create posts" ON public.community_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON public.community_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON public.community_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Community comments policies
CREATE POLICY "Anyone can view comments" ON public.community_comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON public.community_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON public.community_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON public.community_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Community likes policies
CREATE POLICY "Anyone can view likes" ON public.community_likes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage their own likes" ON public.community_likes
  FOR ALL USING (auth.uid() = user_id);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updating timestamps
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_temples_updated_at BEFORE UPDATE ON public.temples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_slots_updated_at BEFORE UPDATE ON public.slots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crowd_simulations_updated_at BEFORE UPDATE ON public.crowd_simulations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_posts_updated_at BEFORE UPDATE ON public.community_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_community_comments_updated_at BEFORE UPDATE ON public.community_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate booking ID
CREATE OR REPLACE FUNCTION generate_booking_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'TCM' || to_char(EXTRACT(EPOCH FROM NOW())::bigint, 'FM999999999999999999') || 
           substring(md5(random()::text) from 1 for 5);
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate booking ID
CREATE OR REPLACE FUNCTION set_booking_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.booking_id IS NULL THEN
        NEW.booking_id = generate_booking_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_id_trigger
    BEFORE INSERT ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION set_booking_id();

-- Function to update slot capacity when booking is created/updated/deleted
CREATE OR REPLACE FUNCTION update_slot_capacity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.slots 
        SET current_bookings = current_bookings + NEW.visitors_count,
            is_available = (current_bookings + NEW.visitors_count < max_capacity)
        WHERE id = NEW.slot_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle booking updates (status changes, visitor count changes)
        IF OLD.status != NEW.status OR OLD.visitors_count != NEW.visitors_count THEN
            UPDATE public.slots 
            SET current_bookings = current_bookings - OLD.visitors_count + NEW.visitors_count,
                is_available = (current_bookings - OLD.visitors_count + NEW.visitors_count < max_capacity)
            WHERE id = NEW.slot_id;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.slots 
        SET current_bookings = current_bookings - OLD.visitors_count,
            is_available = (current_bookings - OLD.visitors_count < max_capacity)
        WHERE id = OLD.slot_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_slot_capacity_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION update_slot_capacity();

-- Function to update temple occupancy
CREATE OR REPLACE FUNCTION update_temple_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    -- Update temple current occupancy based on active bookings
    UPDATE public.temples 
    SET current_occupancy = (
        SELECT COALESCE(SUM(visitors_count), 0)
        FROM public.bookings b
        JOIN public.slots s ON b.slot_id = s.id
        WHERE s.temple_id = temples.id 
        AND b.status = 'confirmed'
        AND s.date = CURRENT_DATE
        AND s.start_time <= CURRENT_TIME
        AND s.end_time > CURRENT_TIME
    ),
    last_updated = NOW()
    WHERE id = (
        SELECT s.temple_id 
        FROM public.slots s 
        WHERE s.id = COALESCE(NEW.slot_id, OLD.slot_id)
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_temple_occupancy_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION update_temple_occupancy();

-- Insert sample data
INSERT INTO public.temples (name, city, state, latitude, longitude, address, description, max_visitors_per_slot, total_daily_capacity, open_time, close_time) VALUES
('Tirumala Tirupati Devasthanams', 'Tirupati', 'Andhra Pradesh', 13.6288, 79.4192, 'Tirumala, Andhra Pradesh 517504', 'One of the most visited religious places in the world, dedicated to Lord Venkateswara.', 100, 5000, '03:00', '23:00'),
('Kashi Vishwanath Temple', 'Varanasi', 'Uttar Pradesh', 25.3110, 82.9966, 'Vishwanath Gali, Varanasi, Uttar Pradesh 221001', 'One of the most famous Hindu temples dedicated to Lord Shiva, located on the western bank of the holy river Ganga.', 80, 4000, '04:00', '23:00'),
('Golden Temple (Harmandir Sahib)', 'Amritsar', 'Punjab', 31.6200, 74.8765, 'Golden Temple Rd, Atta Mandi, Katra Ahluwalia, Amritsar, Punjab 143006', 'The holiest Gurdwara of Sikhism, known for its stunning golden architecture.', 120, 6000, '03:00', '22:00'),
('Somnath Temple', 'Veraval', 'Gujarat', 20.8870, 70.4030, 'Somnath, Gujarat 362268', 'The first among the twelve Jyotirlinga shrines of Lord Shiva.', 90, 4500, '06:00', '21:00'),
('Meenakshi Amman Temple', 'Madurai', 'Tamil Nadu', 9.9196, 78.1193, 'Madurai Main, Madurai, Tamil Nadu 625001', 'Ancient temple dedicated to Goddess Meenakshi and Lord Sundareswarar.', 100, 5000, '05:00', '22:00'),
('Dwarkadhish Temple', 'Dwarka', 'Gujarat', 22.2403, 68.9686, 'Dwarka, Gujarat 361335', 'One of the four sacred Hindu pilgrimage sites, dedicated to Lord Krishna.', 80, 4000, '06:30', '21:00'),
('Vaishno Devi Temple', 'Katra', 'Jammu and Kashmir', 33.0295, 74.9478, 'Katra, Jammu and Kashmir 182301', 'Sacred cave shrine dedicated to Goddess Vaishno Devi.', 60, 3000, '05:00', '22:00'),
('Kamakhya Temple', 'Guwahati', 'Assam', 26.1667, 91.7036, 'Kamakhya, Guwahati, Assam 781010', 'One of the oldest of the 51 Shakti Peethas, dedicated to Goddess Kamakhya.', 70, 3500, '05:30', '22:00');

-- Create some sample slots for the temples
INSERT INTO public.slots (temple_id, date, start_time, end_time, max_capacity)
SELECT 
    t.id,
    CURRENT_DATE + INTERVAL '1 day',
    '06:00'::time + (generate_series * INTERVAL '30 minutes'),
    '06:30'::time + (generate_series * INTERVAL '30 minutes'),
    t.max_visitors_per_slot
FROM public.temples t
CROSS JOIN generate_series(0, 35) -- Create slots for 18 hours (6 AM to 12 AM)
WHERE t.is_active = true;
