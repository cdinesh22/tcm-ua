const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  temple: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Temple',
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  startTime: {
    type: String,
    required: true // Format: "09:00"
  },
  endTime: {
    type: String,
    required: true // Format: "09:30"
  },
  capacity: {
    type: Number,
    required: true,
    min: [1, 'Capacity must be at least 1']
  },
  bookedCount: {
    type: Number,
    default: 0,
    min: 0
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  status: {
    type: String,
    enum: ['available', 'full', 'cancelled', 'maintenance'],
    default: 'available'
  },
  specialEvent: {
    name: String,
    description: String,
    additionalPrice: { type: Number, default: 0 }
  },
  restrictions: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
slotSchema.index({ temple: 1, date: 1, startTime: 1 });
slotSchema.index({ date: 1, status: 1 });

// Virtual for available spots
slotSchema.virtual('availableSpots').get(function() {
  return Math.max(0, this.capacity - this.bookedCount);
});

// Virtual for occupancy percentage
slotSchema.virtual('occupancyPercentage').get(function() {
  return Math.round((this.bookedCount / this.capacity) * 100);
});

// Method to check if slot is bookable
slotSchema.methods.isBookable = function(requestedCount = 1) {
  return this.status === 'available' && 
         this.isActive && 
         this.availableSpots >= requestedCount &&
         new Date() < new Date(`${this.date.toISOString().split('T')[0]}T${this.startTime}:00`);
};

// Method to update status based on booking count
slotSchema.methods.updateStatus = function() {
  if (this.bookedCount >= this.capacity) {
    this.status = 'full';
  } else if (this.status === 'full' && this.bookedCount < this.capacity) {
    this.status = 'available';
  }
};

// Pre-save middleware to update status
slotSchema.pre('save', function(next) {
  this.updateStatus();
  next();
});

module.exports = mongoose.model('Slot', slotSchema);
