const mongoose = require('mongoose');
const moment = require('moment');
require('dotenv').config();

// Import models
const User = require('../models/User');
const Temple = require('../models/Temple');
const Slot = require('../models/Slot');
const Booking = require('../models/Booking');
const CrowdSimulation = require('../models/CrowdSimulation');

// Helper to build a minimal valid temple payload per schema
function makeTemple({
  name,
  city,
  state,
  latitude,
  longitude,
  address,
  websiteUrl,
  description,
}) {
  return {
    name,
    location: {
      city,
      state,
      coordinates: { latitude, longitude },
      address,
    },
    description: description || `${name} is a major pilgrimage destination in ${city}, ${state}.`,
    images: [],
    capacity: {
      maxVisitorsPerSlot: 200,
      totalDailyCapacity: 4000,
    },
    timings: {
      openTime: '06:00',
      closeTime: '22:00',
      slotDuration: 30,
      breakTime: [],
    },
    facilities: [
      {
        name: 'Main Parking',
        description: 'Parking facility for devotees',
        coordinates: { latitude: latitude + 0.0005, longitude: longitude + 0.0005 },
        type: 'parking',
      },
    ],
    currentStatus: { isOpen: true, currentOccupancy: 0, lastUpdated: new Date() },
    rules: [
      'Dress modestly and maintain decorum',
      'Photography may be restricted in certain areas',
      'Follow queue discipline',
    ],
    emergencyContacts: [
      { name: 'Temple Office', phone: '0000000000', role: 'Administration' },
    ],
    externalSources: { websiteUrl, rssFeeds: [] },
    isActive: true,
  };
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/temple_crowd_management', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    await User.deleteMany({});
    await Temple.deleteMany({});
    await Slot.deleteMany({});
    await Booking.deleteMany({});
    await CrowdSimulation.deleteMany({});

    console.log('🗑️  Cleared existing data');

    // Ensure no legacy geospatial index remains on temples collection
    try {
      const idx = await Temple.collection.indexes();
      const geoIndexes = idx.filter(i => i.key && Object.keys(i.key).some(k => k.startsWith('location.coordinates')));
      for (const i of geoIndexes) {
        try {
          await Temple.collection.dropIndex(i.name);
          console.log('🧹 Dropped legacy index:', i.name);
        } catch (e) {
          console.warn('⚠️  Could not drop index', i.name, e.message);
        }
      }
    } catch (e) {
      console.warn('⚠️  Index inspection failed (may be fine on fresh DB):', e.message);
    }

    // Create Admin User
    const adminUser = await User.create({
      name: 'Temple Admin',
      email: process.env.ADMIN_EMAIL || 'admin@temple.com',
      phone: '9876543210',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin'
    });

    console.log('👤 Created admin user');

    // Create Sample Pilgrims (users only)
    const pilgrims = await User.create([
      {
        name: 'Rajesh Kumar',
        email: 'rajesh@example.com',
        phone: '9876543211',
        password: 'pilgrim123',
        role: 'pilgrim',
        preferences: {
          language: 'hindi',
          notifications: { email: true, sms: true }
        }
      },
      {
        name: 'Priya Sharma',
        email: 'priya@example.com',
        phone: '9876543212',
        password: 'pilgrim123',
        role: 'pilgrim',
        preferences: {
          language: 'english',
          notifications: { email: true, sms: false }
        }
      },
      {
        name: 'Amit Patel',
        email: 'amit@example.com',
        phone: '9876543213',
        password: 'pilgrim123',
        role: 'pilgrim',
        preferences: {
          language: 'gujarati',
          notifications: { email: false, sms: true }
        }
      }
    ]);

    console.log('👥 Created sample pilgrims');

    // Create base Temples
    let temples = await Temple.create([
      {
        name: 'Somnath Temple',
        location: {
          city: 'Somnath',
          state: 'Gujarat',
          coordinates: {
            latitude: 20.8880,
            longitude: 70.4017
          },
          address: 'Somnath, Gir Somnath, Gujarat 362268'
        },
        description: 'The Somnath temple is one of the most sacred pilgrimage sites for Hindus and is believed to be the first among the twelve Jyotirlinga shrines of Shiva.',
        images: [
          { url: '/images/somnath-1.svg', caption: 'Main temple view' },
          { url: '/images/somnath-2.svg', caption: 'Evening aarti' },
        ],
        capacity: {
          maxVisitorsPerSlot: 200,
          totalDailyCapacity: 4000
        },
        timings: {
          openTime: '06:00',
          closeTime: '22:00',
          slotDuration: 30,
          breakTime: [
            {
              start: '12:00',
              end: '13:00',
              reason: 'Afternoon break'
            }
          ]
        },
        facilities: [
          {
            name: 'Main Parking',
            description: 'Large parking area for cars and buses',
            coordinates: { latitude: 20.8875, longitude: 70.4010 },
            type: 'parking'
          },
          {
            name: 'Food Court',
            description: 'Vegetarian food and refreshments',
            coordinates: { latitude: 20.8885, longitude: 70.4020 },
            type: 'food'
          },
          {
            name: 'Medical Center',
            description: 'First aid and medical assistance',
            coordinates: { latitude: 20.8882, longitude: 70.4015 },
            type: 'medical'
          },
          {
            name: 'Main Entrance',
            description: 'Primary entrance to the temple',
            coordinates: { latitude: 20.8878, longitude: 70.4018 },
            type: 'entrance'
          }
        ],
        currentStatus: {
          isOpen: true,
          currentOccupancy: 45,
          lastUpdated: new Date()
        },
        rules: [
          'Remove footwear before entering',
          'Mobile phones should be on silent mode',
          'Photography is not allowed inside the main sanctum',
          'Maintain silence and respect the sacred atmosphere'
        ],
        emergencyContacts: [
          {
            name: 'Temple Security',
            phone: '02876-231234',
            role: 'Security'
          },
          {
            name: 'Medical Emergency',
            phone: '108',
            role: 'Medical'
          }
        ],
        externalSources: {
          websiteUrl: 'https://somnath.org',
          rssFeeds: []
        }
      },
      {
        name: 'Dwarkadhish Temple',
        location: {
          city: 'Dwarka',
          state: 'Gujarat',
          coordinates: {
            latitude: 22.2394,
            longitude: 68.9678
          },
          address: 'Dwarka, Gujarat 361335'
        },
        description: 'Dwarkadhish Temple, also known as the Jagat Mandir, is a Hindu temple dedicated to the god Krishna, who is worshipped here by the name Dwarkadhish.',
        images: [
          { url: '/images/dwarka-1.svg', caption: 'Temple architecture' },
        ],
        capacity: {
          maxVisitorsPerSlot: 150,
          totalDailyCapacity: 3000
        },
        timings: {
          openTime: '06:30',
          closeTime: '21:30',
          slotDuration: 30
        },
        facilities: [
          {
            name: 'Visitor Parking',
            description: 'Parking facility for devotees',
            coordinates: { latitude: 22.2390, longitude: 68.9675 },
            type: 'parking'
          },
          {
            name: 'Prasadam Counter',
            description: 'Temple prasadam and offerings',
            coordinates: { latitude: 22.2396, longitude: 68.9680 },
            type: 'food'
          }
        ],
        currentStatus: {
          isOpen: true,
          currentOccupancy: 32,
          lastUpdated: new Date()
        },
        rules: [
          'Dress modestly',
          'No leather items allowed',
          'Follow queue discipline'
        ],
        emergencyContacts: [
          {
            name: 'Temple Office',
            phone: '02892-234567',
            role: 'Administration'
          }
        ],
        externalSources: {
          websiteUrl: 'https://dwarkadhish.org',
          rssFeeds: []
        }
      },
      {
        name: 'Ambaji Temple',
        location: {
          city: 'Ambaji',
          state: 'Gujarat',
          coordinates: {
            latitude: 24.2120,
            longitude: 72.8631
          },
          address: 'Ambaji, Banaskantha, Gujarat 385110'
        },
        description: 'Ambaji Temple is one of the 51 Shakti Peethas and is considered one of the most sacred places for Shakti worship.',
        capacity: {
          maxVisitorsPerSlot: 180,
          totalDailyCapacity: 3600
        },
        timings: {
          openTime: '05:30',
          closeTime: '22:30',
          slotDuration: 30
        },
        facilities: [
          {
            name: 'Devotee Parking',
            description: 'Multi-level parking facility',
            coordinates: { latitude: 24.2115, longitude: 72.8625 },
            type: 'parking'
          }
        ],
        currentStatus: {
          isOpen: true,
          currentOccupancy: 67,
          lastUpdated: new Date()
        },
        externalSources: {
          websiteUrl: 'https://ambajitemple.in',
          rssFeeds: []
        }
      },
      {
        name: 'Pavagadh Temple',
        location: {
          city: 'Pavagadh',
          state: 'Gujarat',
          coordinates: {
            latitude: 22.4833,
            longitude: 73.5333
          },
          address: 'Pavagadh, Panchmahal, Gujarat 389360'
        },
        description: 'Kalika Mata Temple at Pavagadh is a Hindu temple of Goddess Kalika, located on the summit of Pavagadh Hill.',
        capacity: {
          maxVisitorsPerSlot: 120,
          totalDailyCapacity: 2400
        },
        timings: {
          openTime: '06:00',
          closeTime: '21:00',
          slotDuration: 30
        },
        facilities: [
          {
            name: 'Ropeway Station',
            description: 'Cable car facility to reach temple',
            coordinates: { latitude: 22.4830, longitude: 73.5330 },
            type: 'entrance'
          }
        ],
        currentStatus: {
          isOpen: true,
          currentOccupancy: 28,
          lastUpdated: new Date()
        },
        externalSources: {
          websiteUrl: 'https://pavagadhshaktipeeth.org',
          rssFeeds: []
        }
      }
    ]);

    console.log('🏛️  Created temples');

    // Insert additional major temples (merged from user request)
    const additionalTemples = [
      makeTemple({
        name: 'Akshardham Temple (Gandhinagar)',
        city: 'Gandhinagar', state: 'Gujarat', latitude: 23.2367, longitude: 72.6670,
        address: 'Akshardham, Sector 20, Gandhinagar, Gujarat', websiteUrl: 'https://akshardham.com/gujarat/',
        description: 'Swaminarayan Akshardham in Gandhinagar is a renowned spiritual and cultural complex.'
      }),
      makeTemple({
        name: 'Dakshinamurthy Temple (Bhavnagar)',
        city: 'Bhavnagar', state: 'Gujarat', latitude: 21.7645, longitude: 72.1519,
        address: 'Bhavnagar, Gujarat', websiteUrl: 'https://bhavnagartourism.in',
        description: 'Dakshinamurthy Temple is a noted shrine in Bhavnagar dedicated to Lord Shiva as Guru.'
      }),
      makeTemple({
        name: 'Kashi Vishwanath Temple',
        city: 'Varanasi', state: 'Uttar Pradesh', latitude: 25.3109, longitude: 83.0104,
        address: 'Lahori Tola, Varanasi, Uttar Pradesh 221001', websiteUrl: 'https://shrikashivishwanath.org'
      }),
      makeTemple({
        name: 'Tirumala Tirupati Devasthanam (TTD)',
        city: 'Tirupati', state: 'Andhra Pradesh', latitude: 13.6836, longitude: 79.3475,
        address: 'Tirumala, Tirupati, Andhra Pradesh 517504', websiteUrl: 'https://tirumala.org',
        description: 'World-famous hill shrine of Lord Venkateswara with online services for booking.'
      }),
      makeTemple({
        name: 'Shirdi Sai Baba Temple',
        city: 'Shirdi', state: 'Maharashtra', latitude: 19.7665, longitude: 74.4762,
        address: 'Shirdi, Maharashtra 423109', websiteUrl: 'https://sai.org.in'
      }),
      makeTemple({
        name: 'Vaishno Devi Shrine',
        city: 'Katra', state: 'Jammu and Kashmir', latitude: 33.0337, longitude: 74.9490,
        address: 'Katra, Reasi, Jammu and Kashmir 182301', websiteUrl: 'https://www.maavaishnodevi.org'
      }),
      makeTemple({
        name: 'Jagannath Temple (Puri)',
        city: 'Puri', state: 'Odisha', latitude: 19.8040, longitude: 85.8180,
        address: 'Puri, Odisha 752001', websiteUrl: 'https://shreejagannatha.in'
      }),
      makeTemple({
        name: 'Golden Temple (Harmandir Sahib)',
        city: 'Amritsar', state: 'Punjab', latitude: 31.6200, longitude: 74.8765,
        address: 'Golden Temple Rd, Amritsar, Punjab 143006', websiteUrl: 'https://www.goldentempleamritsar.org'
      }),
      makeTemple({
        name: 'Siddhivinayak Temple',
        city: 'Mumbai', state: 'Maharashtra', latitude: 19.0176, longitude: 72.8306,
        address: 'SK Bole Marg, Prabhadevi, Mumbai, Maharashtra 400028', websiteUrl: 'https://www.siddhivinayak.org'
      }),
      makeTemple({
        name: 'Meenakshi Amman Temple',
        city: 'Madurai', state: 'Tamil Nadu', latitude: 9.9195, longitude: 78.1193,
        address: 'Madurai Main, Madurai, Tamil Nadu 625001', websiteUrl: 'https://maduraitourism.co.in'
      }),
      makeTemple({
        name: 'Kamakhya Temple',
        city: 'Guwahati', state: 'Assam', latitude: 26.1667, longitude: 91.7086,
        address: 'Kamakhya, Guwahati, Assam 781010', websiteUrl: 'https://kamakhyatemple.org'
      }),
      makeTemple({
        name: 'Mahakaleshwar Jyotirlinga',
        city: 'Ujjain', state: 'Madhya Pradesh', latitude: 23.1828, longitude: 75.7680,
        address: 'Ujjain, Madhya Pradesh 456006', websiteUrl: 'https://shrimahakaleshwar.com'
      }),
      makeTemple({
        name: 'Omkareshwar Jyotirlinga',
        city: 'Khandwa', state: 'Madhya Pradesh', latitude: 22.2411, longitude: 76.1524,
        address: 'Omkareshwar, Khandwa, Madhya Pradesh 450554', websiteUrl: 'https://shriomkareshwar.org'
      }),
      makeTemple({
        name: 'Kedarnath Temple',
        city: 'Rudraprayag', state: 'Uttarakhand', latitude: 30.7352, longitude: 79.0669,
        address: 'Kedarnath, Rudraprayag, Uttarakhand 246445', websiteUrl: 'https://badrinath-kedarnath.gov.in'
      }),
      makeTemple({
        name: 'Badrinath Temple',
        city: 'Chamoli', state: 'Uttarakhand', latitude: 30.7433, longitude: 79.4930,
        address: 'Badrinath, Chamoli, Uttarakhand 246422', websiteUrl: 'https://badrinath-kedarnath.gov.in'
      }),
      makeTemple({
        name: 'Amarnath Cave Shrine',
        city: 'Anantnag', state: 'Jammu and Kashmir', latitude: 34.2130, longitude: 75.5020,
        address: 'Amarnath, Jammu and Kashmir', websiteUrl: 'https://jksasb.nic.in'
      }),
      makeTemple({
        name: 'Ramanathaswamy Temple (Rameswaram)',
        city: 'Rameswaram', state: 'Tamil Nadu', latitude: 9.2881, longitude: 79.3174,
        address: 'Rameswaram, Tamil Nadu 623526', websiteUrl: 'https://rameswaramtourism.co.in'
      }),
      makeTemple({
        name: 'Sabarimala Sree Dharma Sastha Temple',
        city: 'Pathanamthitta', state: 'Kerala', latitude: 9.4420, longitude: 77.0737,
        address: 'Sabarimala, Pathanamthitta, Kerala 689662', websiteUrl: 'https://sabarimala.kerala.gov.in'
      }),
      makeTemple({
        name: 'Guruvayur Sreekrishna Temple',
        city: 'Thrissur', state: 'Kerala', latitude: 10.5940, longitude: 76.0400,
        address: 'Guruvayur, Thrissur, Kerala 680101', websiteUrl: 'https://guruvayurdevaswom.in'
      }),
      makeTemple({
        name: 'Sree Padmanabhaswamy Temple',
        city: 'Thiruvananthapuram', state: 'Kerala', latitude: 8.4828, longitude: 76.9410,
        address: 'East Fort, Thiruvananthapuram, Kerala 695023', websiteUrl: 'https://padmanabhaswamytemple.org'
      }),
      makeTemple({
        name: 'Akshardham Temple (Delhi)',
        city: 'New Delhi', state: 'Delhi', latitude: 28.6127, longitude: 77.2773,
        address: 'Noida Mor, Pandav Nagar, New Delhi, Delhi 110092', websiteUrl: 'https://akshardham.com/delhi/'
      }),
      makeTemple({
        name: 'Banke Bihari Temple',
        city: 'Vrindavan', state: 'Uttar Pradesh', latitude: 27.5806, longitude: 77.7000,
        address: 'Goda Vihar, Vrindavan, Uttar Pradesh 281121', websiteUrl: 'https://www.bankeebihari.org'
      }),
      makeTemple({
        name: 'ISKCON Vrindavan',
        city: 'Vrindavan', state: 'Uttar Pradesh', latitude: 27.5650, longitude: 77.6610,
        address: 'Bhaktivedanta Swami Marg, Vrindavan, Uttar Pradesh 281121', websiteUrl: 'https://iskconvrindavan.com'
      }),
      makeTemple({
        name: 'Udupi Sri Krishna Matha',
        city: 'Udupi', state: 'Karnataka', latitude: 13.3409, longitude: 74.7461,
        address: 'Car Street, Udupi, Karnataka 576101', websiteUrl: 'https://udupikrishnamutt.com'
      }),
      makeTemple({
        name: 'Virupaksha Temple (Hampi)',
        city: 'Hampi', state: 'Karnataka', latitude: 15.3350, longitude: 76.4600,
        address: 'Hampi, Vijayanagara, Karnataka 583239', websiteUrl: 'https://karnatakatourism.org/tour-item/virupaksha-temple-hampi/'
      }),
      makeTemple({
        name: 'Mahabodhi Temple (Bodh Gaya)',
        city: 'Bodh Gaya', state: 'Bihar', latitude: 24.6950, longitude: 84.9910,
        address: 'Bodh Gaya, Bihar 824231', websiteUrl: 'https://bodhgayatemple.org'
      }),
      makeTemple({
        name: 'Shrinathji Temple (Nathdwara)',
        city: 'Nathdwara', state: 'Rajasthan', latitude: 24.9387, longitude: 73.8228,
        address: 'Nathdwara, Rajasthan 313301', websiteUrl: 'https://nathdwaratemple.org'
      }),
      makeTemple({
        name: 'Kalighat Kali Temple',
        city: 'Kolkata', state: 'West Bengal', latitude: 22.5203, longitude: 88.3425,
        address: 'Kalighat, Kolkata, West Bengal 700026', websiteUrl: 'https://kalighattemple.com'
      }),
    ];

    // Enrich popular temples with images and richer facilities
    const enrich = (name, data) => {
      const idx = additionalTemples.findIndex(t => t.name === name);
      if (idx >= 0) {
        additionalTemples[idx] = { ...additionalTemples[idx], ...data };
      }
    };

    enrich('Kashi Vishwanath Temple', {
      images: [
        { url: '/images/kashi-1.svg', caption: 'Temple corridor' },
        { url: '/images/kashi-2.svg', caption: 'Evening Ganga Aarti nearby' },
      ],
      facilities: [
        { name: 'Ghat Access', description: 'Access to nearby ghats', coordinates: { latitude: 25.3115, longitude: 83.0095 }, type: 'entrance' },
        { name: 'Medical Aid', description: 'First aid kiosk', coordinates: { latitude: 25.3111, longitude: 83.0109 }, type: 'medical' },
        { name: 'Restrooms', description: 'Clean restroom block', coordinates: { latitude: 25.3102, longitude: 83.0099 }, type: 'restroom' },
      ],
    });

    enrich('Tirumala Tirupati Devasthanam (TTD)', {
      images: [
        { url: '/images/ttd-1.svg', caption: 'Main gopuram' },
        { url: '/images/ttd-2.svg', caption: 'Queue complex' },
      ],
      facilities: [
        { name: 'Queue Complex', description: 'Organized queue system', coordinates: { latitude: 13.6839, longitude: 79.3481 }, type: 'entrance' },
        { name: 'Annadanam Hall', description: 'Free meals for devotees', coordinates: { latitude: 13.6841, longitude: 79.3472 }, type: 'food' },
        { name: 'Health Center', description: 'Medical assistance', coordinates: { latitude: 13.6830, longitude: 79.3479 }, type: 'medical' },
      ],
    });

    enrich('Golden Temple (Harmandir Sahib)', {
      images: [
        { url: '/images/golden-1.svg', caption: 'Harmandir Sahib at dusk' },
      ],
      facilities: [
        { name: 'Langar Hall', description: 'Community kitchen', coordinates: { latitude: 31.6203, longitude: 74.8769 }, type: 'food' },
        { name: 'Shoe Storage', description: 'Footwear counter', coordinates: { latitude: 31.6196, longitude: 74.8760 }, type: 'entrance' },
        { name: 'First Aid', description: 'Medical helpdesk', coordinates: { latitude: 31.6206, longitude: 74.8757 }, type: 'medical' },
      ],
    });

    enrich('Meenakshi Amman Temple', {
      images: [
        { url: '/images/meenakshi-1.svg', caption: 'Temple towers' },
      ],
      facilities: [
        { name: 'North Gate', description: 'Primary entrance', coordinates: { latitude: 9.9199, longitude: 78.1198 }, type: 'entrance' },
        { name: 'Food Court', description: 'Vegetarian meals', coordinates: { latitude: 9.9190, longitude: 78.1188 }, type: 'food' },
        { name: 'Rest Area', description: 'Shaded seating', coordinates: { latitude: 9.9188, longitude: 78.1195 }, type: 'security' },
      ],
    });

    enrich('Vaishno Devi Shrine', {
      images: [
        { url: '/images/vaishno-1.svg', caption: 'Bhawan complex' },
      ],
      facilities: [
        { name: 'Battery Car Stop', description: 'Battery car service point', coordinates: { latitude: 33.0341, longitude: 74.9493 }, type: 'entrance' },
        { name: 'Medical Post', description: 'Emergency medical post', coordinates: { latitude: 33.0331, longitude: 74.9495 }, type: 'medical' },
      ],
    });

    enrich('Kamakhya Temple', {
      images: [
        { url: '/images/kamakhya-1.svg', caption: 'Main dome' },
      ],
      facilities: [
        { name: 'Parking', description: 'Devotee parking', coordinates: { latitude: 26.1671, longitude: 91.7090 }, type: 'parking' },
        { name: 'Queue Entry', description: 'Darshan queue entry', coordinates: { latitude: 26.1669, longitude: 91.7083 }, type: 'entrance' },
      ],
    });

    if (additionalTemples.length) {
      await Temple.insertMany(additionalTemples, { ordered: false });
      console.log(`🏛️  Added ${additionalTemples.length} additional major temples`);
    }

    // Reload complete list for downstream slot/simulation creation
    temples = await Temple.find();

    // Create Slots for next 7 days
    const slots = [];
    for (const temple of temples) {
      for (let day = 0; day < 7; day++) {
        const date = moment().add(day, 'days').startOf('day').toDate();
        
        // Create slots from 6 AM to 10 PM with 30-minute intervals
        for (let hour = 6; hour <= 21; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const endHour = minute === 30 ? hour + 1 : hour;
            const endMinute = minute === 30 ? 0 : 30;
            const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

            // Skip break time
            if (temple.timings.breakTime && temple.timings.breakTime.length > 0) {
              const breakStart = temple.timings.breakTime[0].start;
              const breakEnd = temple.timings.breakTime[0].end;
              if (startTime >= breakStart && startTime < breakEnd) {
                continue;
              }
            }

            slots.push({
              temple: temple._id,
              date,
              startTime,
              endTime,
              capacity: temple.capacity.maxVisitorsPerSlot,
              price: Math.floor(Math.random() * 50) + 10, // Random price between 10-60
              bookedCount: Math.floor(Math.random() * 30) // Random bookings
            });
          }
        }
      }
    }

    await Slot.insertMany(slots);
    console.log('📅 Created time slots');

    // Create Sample Bookings
    const sampleSlots = await Slot.find().limit(20);
    const bookings = [];

    for (let i = 0; i < 15; i++) {
      const randomSlot = sampleSlots[Math.floor(Math.random() * sampleSlots.length)];
      const randomPilgrim = pilgrims[Math.floor(Math.random() * pilgrims.length)];
      const visitorsCount = Math.floor(Math.random() * 4) + 1;

      const timestamp = Date.now().toString(36)
      const random = Math.random().toString(36).substr(2, 5)
      const booking = {
        bookingId: `TCM${timestamp}${random}`.toUpperCase(),
        user: randomPilgrim._id,
        temple: randomSlot.temple,
        slot: randomSlot._id,
        visitorsCount,
        visitors: Array.from({ length: visitorsCount }, (_, index) => ({
          name: `Visitor ${index + 1}`,
          age: Math.floor(Math.random() * 60) + 10,
          gender: ['male', 'female'][Math.floor(Math.random() * 2)]
        })),
        contactInfo: {
          email: randomPilgrim.email,
          phone: randomPilgrim.phone
        },
        totalAmount: randomSlot.price * visitorsCount,
        qrCode: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`,
        status: ['confirmed', 'completed', 'cancelled'][Math.floor(Math.random() * 3)],
        createdAt: moment().subtract(Math.floor(Math.random() * 30), 'days').toDate()
      };

      bookings.push(booking);
    }

    // Use create() instead of insertMany() so pre('save') middleware runs and bookingId is generated
    await Booking.create(bookings);
    console.log('🎫 Created sample bookings');

    // Create Crowd Simulation Data
    const crowdSimulations = [];
    for (const temple of temples) {
      for (let day = -3; day < 4; day++) {
        const date = moment().add(day, 'days').startOf('day').toDate();
        
        const hourlyData = [];
        for (let hour = 6; hour <= 22; hour++) {
          const baseVisitors = Math.floor(temple.capacity.maxVisitorsPerSlot * 0.3);
          const peakMultiplier = (hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 20) ? 2.5 : 1;
          const randomFactor = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
          
          const expectedVisitors = Math.floor(baseVisitors * peakMultiplier * randomFactor);
          const actualVisitors = day <= 0 ? Math.floor(expectedVisitors * (0.7 + Math.random() * 0.6)) : 0;

          hourlyData.push({
            hour,
            expectedVisitors,
            actualVisitors,
            crowdDensity: actualVisitors > expectedVisitors * 0.8 ? 'high' : 
                         actualVisitors > expectedVisitors * 0.5 ? 'medium' : 'low',
            waitTime: actualVisitors > expectedVisitors * 0.8 ? Math.floor(Math.random() * 20) + 10 : 
                     actualVisitors > expectedVisitors * 0.5 ? Math.floor(Math.random() * 10) + 5 : 0,
            areas: [
              {
                name: 'Main Temple',
                coordinates: temple.location.coordinates,
                capacity: temple.capacity.maxVisitorsPerSlot,
                currentOccupancy: Math.floor(actualVisitors * 0.6),
                densityLevel: actualVisitors > expectedVisitors * 0.8 ? 'high' : 'medium'
              },
              {
                name: 'Queue Area',
                coordinates: {
                  latitude: temple.location.coordinates.latitude + 0.001,
                  longitude: temple.location.coordinates.longitude + 0.001
                },
                capacity: Math.floor(temple.capacity.maxVisitorsPerSlot * 0.5),
                currentOccupancy: Math.floor(actualVisitors * 0.4),
                densityLevel: 'medium'
              }
            ]
          });
        }

        const simulation = {
          temple: temple._id,
          date,
          hourlyData,
          peakHours: [
            { startHour: 8, endHour: 10, expectedCrowd: temple.capacity.maxVisitorsPerSlot * 2, reason: 'Morning prayers' },
            { startHour: 18, endHour: 20, expectedCrowd: temple.capacity.maxVisitorsPerSlot * 2, reason: 'Evening aarti' }
          ],
          alerts: day === 0 && Math.random() > 0.7 ? [{
            type: 'overcrowding',
            severity: 'medium',
            message: 'Higher than expected crowd during evening hours',
            affectedAreas: ['Main Temple'],
            isActive: true
          }] : [],
          weatherImpact: {
            condition: ['sunny', 'cloudy', 'rainy'][Math.floor(Math.random() * 3)],
            temperature: Math.floor(Math.random() * 15) + 20,
            impactLevel: 'low',
            expectedReduction: 0
          }
        };

        crowdSimulations.push(simulation);
      }
    }

    await CrowdSimulation.insertMany(crowdSimulations);
    console.log('📊 Created crowd simulation data');

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\n📋 Sample Login Credentials:');
    console.log('Admin:');
    console.log(`  Email: ${adminUser.email}`);
    console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
    console.log('\nPilgrims:');
    pilgrims.forEach(pilgrim => {
      console.log(`  Email: ${pilgrim.email}, Password: pilgrim123`);
    });

    console.log('\n🏛️  Created Temples:');
    temples.forEach(temple => {
      console.log(`  - ${temple.name} (${temple.location.city})`);
    });

    console.log(`\n📈 Statistics:`);
    console.log(`  - ${temples.length} temples`);
    console.log(`  - ${pilgrims.length + 1} users (${pilgrims.length} pilgrims + 1 admin)`);
    console.log(`  - ${slots.length} time slots`);
    console.log(`  - ${bookings.length} sample bookings`);
    console.log(`  - ${crowdSimulations.length} crowd simulation records`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
  }
};

// Run the seed function
seedData();
