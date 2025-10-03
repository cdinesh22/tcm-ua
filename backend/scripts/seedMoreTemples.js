const mongoose = require('mongoose');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const Temple = require('../models/Temple');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/temple_crowd_management';

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

async function upsertTemples() {
  const temples = [
    // User-provided list
    makeTemple({
      name: 'Akshardham Temple (Gandhinagar)',
      city: 'Gandhinagar',
      state: 'Gujarat',
      latitude: 23.2367,
      longitude: 72.6670,
      address: 'Akshardham, Sector 20, Gandhinagar, Gujarat',
      websiteUrl: 'https://akshardham.com/gujarat/',
      description: 'Swaminarayan Akshardham in Gandhinagar is a renowned spiritual and cultural complex.',
    }),
    makeTemple({
      name: 'Dakshinamurthy Temple (Bhavnagar)',
      city: 'Bhavnagar',
      state: 'Gujarat',
      latitude: 21.7645,
      longitude: 72.1519,
      address: 'Bhavnagar, Gujarat',
      websiteUrl: 'https://bhavnagartourism.in',
      description: 'Dakshinamurthy Temple is a noted shrine in Bhavnagar dedicated to Lord Shiva as Guru.',
    }),

    makeTemple({
      name: 'Kashi Vishwanath Temple',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      latitude: 25.3109,
      longitude: 83.0104,
      address: 'Lahori Tola, Varanasi, Uttar Pradesh 221001',
      websiteUrl: 'https://shrikashivishwanath.org',
    }),
    makeTemple({
      name: 'Tirumala Tirupati Devasthanam (TTD)',
      city: 'Tirupati',
      state: 'Andhra Pradesh',
      latitude: 13.6836,
      longitude: 79.3475,
      address: 'Tirumala, Tirupati, Andhra Pradesh 517504',
      websiteUrl: 'https://tirumala.org',
      description: 'World-famous hill shrine of Lord Venkateswara with online services for booking.',
    }),
    makeTemple({
      name: 'Shirdi Sai Baba Temple',
      city: 'Shirdi',
      state: 'Maharashtra',
      latitude: 19.7665,
      longitude: 74.4762,
      address: 'Shirdi, Maharashtra 423109',
      websiteUrl: 'https://sai.org.in',
    }),
    makeTemple({
      name: 'Vaishno Devi Shrine',
      city: 'Katra',
      state: 'Jammu and Kashmir',
      latitude: 33.0337,
      longitude: 74.9490,
      address: 'Katra, Reasi, Jammu and Kashmir 182301',
      websiteUrl: 'https://www.maavaishnodevi.org',
    }),
    makeTemple({
      name: 'Jagannath Temple (Puri)',
      city: 'Puri',
      state: 'Odisha',
      latitude: 19.8040,
      longitude: 85.8180,
      address: 'Puri, Odisha 752001',
      websiteUrl: 'https://shreejagannatha.in',
    }),
    makeTemple({
      name: 'Golden Temple (Harmandir Sahib)',
      city: 'Amritsar',
      state: 'Punjab',
      latitude: 31.6200,
      longitude: 74.8765,
      address: 'Golden Temple Rd, Amritsar, Punjab 143006',
      websiteUrl: 'https://www.goldentempleamritsar.org',
    }),
    makeTemple({
      name: 'Siddhivinayak Temple',
      city: 'Mumbai',
      state: 'Maharashtra',
      latitude: 19.0176,
      longitude: 72.8306,
      address: 'SK Bole Marg, Prabhadevi, Mumbai, Maharashtra 400028',
      websiteUrl: 'https://www.siddhivinayak.org',
    }),
    makeTemple({
      name: 'Meenakshi Amman Temple',
      city: 'Madurai',
      state: 'Tamil Nadu',
      latitude: 9.9195,
      longitude: 78.1193,
      address: 'Madurai Main, Madurai, Tamil Nadu 625001',
      websiteUrl: 'https://maduraitourism.co.in',
    }),
    makeTemple({
      name: 'Kamakhya Temple',
      city: 'Guwahati',
      state: 'Assam',
      latitude: 26.1667,
      longitude: 91.7086,
      address: 'Kamakhya, Guwahati, Assam 781010',
      websiteUrl: 'https://kamakhyatemple.org',
    }),

    // Additional prominent sites
    makeTemple({
      name: 'Mahakaleshwar Jyotirlinga',
      city: 'Ujjain',
      state: 'Madhya Pradesh',
      latitude: 23.1828,
      longitude: 75.7680,
      address: 'Ujjain, Madhya Pradesh 456006',
      websiteUrl: 'https://shrimahakaleshwar.com',
    }),
    makeTemple({
      name: 'Omkareshwar Jyotirlinga',
      city: 'Khandwa',
      state: 'Madhya Pradesh',
      latitude: 22.2411,
      longitude: 76.1524,
      address: 'Omkareshwar, Khandwa, Madhya Pradesh 450554',
      websiteUrl: 'https://shriomkareshwar.org',
    }),
    makeTemple({
      name: 'Kedarnath Temple',
      city: 'Rudraprayag',
      state: 'Uttarakhand',
      latitude: 30.7352,
      longitude: 79.0669,
      address: 'Kedarnath, Rudraprayag, Uttarakhand 246445',
      websiteUrl: 'https://badrinath-kedarnath.gov.in',
    }),
    makeTemple({
      name: 'Badrinath Temple',
      city: 'Chamoli',
      state: 'Uttarakhand',
      latitude: 30.7433,
      longitude: 79.4930,
      address: 'Badrinath, Chamoli, Uttarakhand 246422',
      websiteUrl: 'https://badrinath-kedarnath.gov.in',
    }),
    makeTemple({
      name: 'Amarnath Cave Shrine',
      city: 'Anantnag',
      state: 'Jammu and Kashmir',
      latitude: 34.2130,
      longitude: 75.5020,
      address: 'Amarnath, Jammu and Kashmir',
      websiteUrl: 'https://jksasb.nic.in',
    }),
    makeTemple({
      name: 'Ramanathaswamy Temple (Rameswaram)',
      city: 'Rameswaram',
      state: 'Tamil Nadu',
      latitude: 9.2881,
      longitude: 79.3174,
      address: 'Rameswaram, Tamil Nadu 623526',
      websiteUrl: 'https://rameswaramtourism.co.in',
    }),
    makeTemple({
      name: 'Sabarimala Sree Dharma Sastha Temple',
      city: 'Pathanamthitta',
      state: 'Kerala',
      latitude: 9.4420,
      longitude: 77.0737,
      address: 'Sabarimala, Pathanamthitta, Kerala 689662',
      websiteUrl: 'https://sabarimala.kerala.gov.in',
    }),
    makeTemple({
      name: 'Guruvayur Sreekrishna Temple',
      city: 'Thrissur',
      state: 'Kerala',
      latitude: 10.5940,
      longitude: 76.0400,
      address: 'Guruvayur, Thrissur, Kerala 680101',
      websiteUrl: 'https://guruvayurdevaswom.in',
    }),
    makeTemple({
      name: 'Sree Padmanabhaswamy Temple',
      city: 'Thiruvananthapuram',
      state: 'Kerala',
      latitude: 8.4828,
      longitude: 76.9410,
      address: 'East Fort, Thiruvananthapuram, Kerala 695023',
      websiteUrl: 'https://padmanabhaswamytemple.org',
    }),
    makeTemple({
      name: 'Akshardham Temple (Delhi)',
      city: 'New Delhi',
      state: 'Delhi',
      latitude: 28.6127,
      longitude: 77.2773,
      address: 'Noida Mor, Pandav Nagar, New Delhi, Delhi 110092',
      websiteUrl: 'https://akshardham.com/delhi/',
    }),
    makeTemple({
      name: 'Banke Bihari Temple',
      city: 'Vrindavan',
      state: 'Uttar Pradesh',
      latitude: 27.5806,
      longitude: 77.7000,
      address: 'Goda Vihar, Vrindavan, Uttar Pradesh 281121',
      websiteUrl: 'https://www.bankeebihari.org',
    }),
    makeTemple({
      name: 'ISKCON Vrindavan',
      city: 'Vrindavan',
      state: 'Uttar Pradesh',
      latitude: 27.5650,
      longitude: 77.6610,
      address: 'Bhaktivedanta Swami Marg, Vrindavan, Uttar Pradesh 281121',
      websiteUrl: 'https://iskconvrindavan.com',
    }),
    makeTemple({
      name: 'Udupi Sri Krishna Matha',
      city: 'Udupi',
      state: 'Karnataka',
      latitude: 13.3409,
      longitude: 74.7461,
      address: 'Car Street, Udupi, Karnataka 576101',
      websiteUrl: 'https://udupikrishnamutt.com',
    }),
    makeTemple({
      name: 'Virupaksha Temple (Hampi)',
      city: 'Hampi',
      state: 'Karnataka',
      latitude: 15.3350,
      longitude: 76.4600,
      address: 'Hampi, Vijayanagara, Karnataka 583239',
      websiteUrl: 'https://karnatakatourism.org/tour-item/virupaksha-temple-hampi/',
    }),
    makeTemple({
      name: 'Mahabodhi Temple (Bodh Gaya)',
      city: 'Bodh Gaya',
      state: 'Bihar',
      latitude: 24.6950,
      longitude: 84.9910,
      address: 'Bodh Gaya, Bihar 824231',
      websiteUrl: 'https://bodhgayatemple.org',
    }),
    makeTemple({
      name: 'Shrinathji Temple (Nathdwara)',
      city: 'Nathdwara',
      state: 'Rajasthan',
      latitude: 24.9387,
      longitude: 73.8228,
      address: 'Nathdwara, Rajasthan 313301',
      websiteUrl: 'https://nathdwaratemple.org',
    }),
    makeTemple({
      name: 'Kalighat Kali Temple',
      city: 'Kolkata',
      state: 'West Bengal',
      latitude: 22.5203,
      longitude: 88.3425,
      address: 'Kalighat, Kolkata, West Bengal 700026',
      websiteUrl: 'https://kalighattemple.com',
    }),
  ];

  let created = 0, updated = 0;
  for (const t of temples) {
    const existing = await Temple.findOne({ name: t.name });
    if (existing) {
      await Temple.updateOne({ _id: existing._id }, { $set: t });
      updated++;
    } else {
      await Temple.create(t);
      created++;
    }
  }
  return { created, updated, total: temples.length };
}

(async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const res = await upsertTemples();
    console.log(`Temples upserted. Created: ${res.created}, Updated: ${res.updated}, Total in batch: ${res.total}`);
  } catch (err) {
    console.error('Error seeding more temples:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log('Closed MongoDB connection');
  }
})();
