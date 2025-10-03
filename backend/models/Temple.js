const mongoose = require('mongoose');

const templeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Temple name is required'],
    unique: true,
    trim: true
  },
  location: {
    city: { type: String, required: true },
    state: { type: String, required: true },
    coordinates: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true }
    },
    address: { type: String, required: true }
  },
  description: {
    type: String,
    required: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  images: [{
    url: String,
    caption: String
  }],
  capacity: {
    maxVisitorsPerSlot: {
      type: Number,
      required: true,
      min: [1, 'Capacity must be at least 1']
    },
    totalDailyCapacity: {
      type: Number,
      required: true
    }
  },
  timings: {
    openTime: { type: String, required: true }, // Format: "06:00"
    closeTime: { type: String, required: true }, // Format: "22:00"
    slotDuration: { type: Number, default: 30 }, // in minutes
    breakTime: [{
      start: String,
      end: String,
      reason: String
    }]
  },
  facilities: [{
    name: String,
    description: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    type: {
      type: String,
      enum: ['parking', 'restroom', 'food', 'medical', 'security', 'exit', 'entrance']
    }
  }],
  currentStatus: {
    isOpen: { type: Boolean, default: true },
    currentOccupancy: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
  },
  rules: [{
    type: String
  }],
  emergencyContacts: [{
    name: String,
    phone: String,
    role: String
  }],
  // Optional: external sources for real-time info aggregation (official site, RSS, etc.)
  externalSources: {
    websiteUrl: { type: String },
    rssFeeds: [{ type: String }]
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// NOTE: Geospatial index removed because the schema stores coordinates as
// separate latitude/longitude numbers, not as GeoJSON Points. If geospatial
// queries are needed, migrate to { type: 'Point', coordinates: [lng, lat] }
// and create a 2dsphere index on that field.

// Virtual for current occupancy percentage
templeSchema.virtual('occupancyPercentage').get(function() {
  return Math.round((this.currentStatus.currentOccupancy / this.capacity.maxVisitorsPerSlot) * 100);
});

// Method to get crowd level
templeSchema.methods.getCrowdLevel = function() {
  const percentage = this.occupancyPercentage;
  if (percentage < 30) return 'low';
  if (percentage < 70) return 'medium';
  return 'high';
};

module.exports = mongoose.model('Temple', templeSchema);
