// models/Notification.js
const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  actionUserId: {  // optional: jisne action liya
    type: String,
    default: null,
  },
  targetUserId: {  // jisko notification dikhani hai
    type: String,
    required: true,
  },
  message: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  read: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
