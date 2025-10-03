# Temple Crowd Management System

A modern temple and pilgrimage crowd management system built with React, Vercel, and Supabase.

## Features

- **User Authentication**: Secure user registration and login with Supabase Auth
- **Temple Management**: Browse and manage temple information
- **Slot Booking**: Book time slots for temple visits
- **Real-time Updates**: Live crowd monitoring and occupancy tracking
- **Admin Dashboard**: Comprehensive analytics and management tools
- **Community Features**: User posts and interactions
- **Multi-language Support**: English, Hindi, and Gujarati
- **Responsive Design**: Mobile-first approach with Tailwind CSS

## Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Deployment**: Vercel
- **Maps**: Leaflet
- **Charts**: Chart.js

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account
- Vercel account

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd temple-crowd-management
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Go to Settings > Database to get your service role key
4. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor

### 3. Environment Variables

Create a `.env.local` file in the `frontend` directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Install Dependencies

```bash
npm run install-all
```

### 5. Development

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Deployment to Vercel

### 1. Install Vercel CLI

```bash
npm i -g vercel
```

### 2. Deploy

```bash
vercel
```

### 3. Environment Variables in Vercel

Set these environment variables in your Vercel dashboard:

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `JWT_SECRET`: A random secret for JWT tokens

### 4. Database Setup

1. Run the SQL schema from `supabase-schema.sql` in your Supabase SQL editor
2. The schema includes:
   - User management tables
   - Temple and slot management
   - Booking system
   - Community features
   - Row Level Security (RLS) policies

## Project Structure

```
├── api/                    # Vercel serverless functions
│   ├── auth/              # Authentication endpoints
│   ├── temples/           # Temple management
│   ├── bookings/          # Booking system
│   ├── slots/             # Slot management
│   ├── analytics/         # Analytics endpoints
│   └── utils/             # Utility functions
├── frontend/              # React frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── pages/         # Page components
│   │   ├── context/       # React context
│   │   ├── api/           # API client
│   │   └── lib/           # Utilities
│   └── public/            # Static assets
├── supabase-schema.sql    # Database schema
├── vercel.json           # Vercel configuration
└── package.json          # Root package.json
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Temples
- `GET /api/temples` - Get all temples
- `GET /api/temples/[id]` - Get temple by ID
- `POST /api/temples` - Create temple (admin)
- `PUT /api/temples/[id]` - Update temple (admin)
- `DELETE /api/temples/[id]` - Delete temple (admin)

### Bookings
- `GET /api/bookings` - Get user bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings/[id]` - Get booking by ID
- `PUT /api/bookings/[id]` - Update booking
- `DELETE /api/bookings/[id]` - Cancel booking

### Slots
- `GET /api/slots` - Get available slots

### Analytics
- `GET /api/analytics` - Get analytics data (admin)

## Database Schema

The system uses the following main tables:

- `users` - User profiles (extends Supabase auth.users)
- `temples` - Temple information
- `slots` - Available time slots
- `bookings` - User bookings
- `contact_messages` - Contact form submissions
- `community_posts` - Community posts
- `community_comments` - Post comments
- `community_likes` - Post likes
- `crowd_simulations` - Crowd simulation data

## Security Features

- Row Level Security (RLS) enabled on all tables
- JWT-based authentication
- Role-based access control (pilgrim/admin)
- Input validation and sanitization
- CORS protection

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support, please open an issue in the GitHub repository or contact the development team.

## Changelog

### Version 1.0.0
- Initial release
- Migrated from Express/MongoDB to Vercel/Supabase
- Added comprehensive temple management system
- Implemented booking and slot management
- Added community features
- Multi-language support
- Admin dashboard with analytics