const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true },
  phone: { type: String, trim: true, maxlength: 20 },
  subject: { type: String, trim: true, maxlength: 150 },
  message: { type: String, required: true, maxlength: 4000 },
  meta: {
    ip: String,
    userAgent: String,
  }
}, { timestamps: true });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
