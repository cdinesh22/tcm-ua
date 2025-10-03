const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingId: {
    type: String,
    unique: true,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  temple: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Temple',
    required: true
  },
  slot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Slot',
    required: true
  },
  visitorsCount: {
    type: Number,
    required: true,
    min: [1, 'At least 1 visitor is required'],
    max: [10, 'Maximum 10 visitors allowed per booking']
  },
  visitors: [{
    name: { type: String, required: true },
    age: { type: Number, required: true, min: 0, max: 120 },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    idType: { type: String, enum: ['aadhar', 'pan', 'passport', 'driving_license'] },
    idNumber: String
  }],
  contactInfo: {
    email: { type: String, required: true },
    phone: { type: String, required: true }
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'completed' // For demo purposes
  },
  paymentDetails: {
    transactionId: String,
    paymentMethod: { type: String, enum: ['online', 'cash', 'card'] },
    paidAt: Date
  },
  qrCode: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'completed', 'no_show'],
    default: 'confirmed'
  },
  checkIn: {
    time: Date,
    location: {
      latitude: Number,
      longitude: Number
    },
    verifiedBy: String
  },
  checkOut: {
    time: Date,
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: String
    }
  },
  specialRequests: [{
    type: String
  }],
  notifications: {
    confirmationSent: { type: Boolean, default: false },
    reminderSent: { type: Boolean, default: false },
    qrCodeSent: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ temple: 1, slot: 1 });
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ 'slot': 1, status: 1 });

// Generate unique booking ID
bookingSchema.pre('save', async function(next) {
  if (!this.bookingId) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.bookingId = `TCM${timestamp}${random}`.toUpperCase();
  }
  next();
});

// Method to check if booking is active
bookingSchema.methods.isActive = function() {
  return this.status === 'confirmed' && this.paymentStatus === 'completed';
};

// Method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
  if (this.status !== 'confirmed') return false;
  
  // Can cancel up to 2 hours before the slot time
  const slotDateTime = new Date(`${this.slot.date}T${this.slot.startTime}:00`);
  const now = new Date();
  const hoursUntilSlot = (slotDateTime - now) / (1000 * 60 * 60);
  
  return hoursUntilSlot > 2;
};

// Virtual for booking date and time
bookingSchema.virtual('bookingDateTime').get(function() {
  return `${this.slot.date.toDateString()} ${this.slot.startTime}`;
});

module.exports = mongoose.model('Booking', bookingSchema);
