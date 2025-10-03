const mongoose = require('mongoose');

const crowdSimulationSchema = new mongoose.Schema({
  temple: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Temple',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  hourlyData: [{
    hour: { type: Number, required: true, min: 0, max: 23 },
    expectedVisitors: { type: Number, required: true, min: 0 },
    actualVisitors: { type: Number, default: 0 },
    crowdDensity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low'
    },
    waitTime: { type: Number, default: 0 }, // in minutes
    areas: [{
      name: { type: String, required: true },
      coordinates: {
        latitude: Number,
        longitude: Number
      },
      capacity: { type: Number, required: true },
      currentOccupancy: { type: Number, default: 0 },
      densityLevel: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low'
      }
    }]
  }],
  peakHours: [{
    startHour: Number,
    endHour: Number,
    expectedCrowd: Number,
    reason: String
  }],
  alerts: [{
    time: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['overcrowding', 'emergency', 'maintenance', 'weather', 'special_event']
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical']
    },
    message: { type: String, required: true },
    affectedAreas: [String],
    isActive: { type: Boolean, default: true },
    resolvedAt: Date
  }],
  weatherImpact: {
    condition: {
      type: String,
      enum: ['sunny', 'rainy', 'cloudy', 'stormy', 'foggy']
    },
    temperature: Number,
    impactLevel: {
      type: String,
      enum: ['none', 'low', 'medium', 'high']
    },
    expectedReduction: Number // percentage reduction in crowd
  },
  recommendations: [{
    type: {
      type: String,
      enum: ['route_diversion', 'capacity_adjustment', 'additional_staff', 'facility_closure']
    },
    message: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent']
    },
    implementedAt: Date
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
crowdSimulationSchema.index({ temple: 1, date: -1 });
crowdSimulationSchema.index({ 'alerts.isActive': 1, 'alerts.severity': 1 });

// Method to calculate overall crowd density
crowdSimulationSchema.methods.getOverallDensity = function() {
  const currentHour = new Date().getHours();
  const currentData = this.hourlyData.find(data => data.hour === currentHour);
  
  if (!currentData) return 'low';
  
  const occupancyPercentage = (currentData.actualVisitors / currentData.expectedVisitors) * 100;
  
  if (occupancyPercentage < 30) return 'low';
  if (occupancyPercentage < 60) return 'medium';
  if (occupancyPercentage < 90) return 'high';
  return 'critical';
};

// Method to get active alerts
crowdSimulationSchema.methods.getActiveAlerts = function() {
  return this.alerts.filter(alert => alert.isActive && !alert.resolvedAt);
};

// Method to add new alert
crowdSimulationSchema.methods.addAlert = function(alertData) {
  this.alerts.push({
    ...alertData,
    time: new Date(),
    isActive: true
  });
  return this.save();
};

// Method to resolve alert
crowdSimulationSchema.methods.resolveAlert = function(alertId) {
  const alert = this.alerts.id(alertId);
  if (alert) {
    alert.isActive = false;
    alert.resolvedAt = new Date();
    return this.save();
  }
  return Promise.reject(new Error('Alert not found'));
};

module.exports = mongoose.model('CrowdSimulation', crowdSimulationSchema);
