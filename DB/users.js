const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fname: { type: String, required: true },
  lname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  profilePic: { type: String }, // Cloudinary URL
  password: { type: String, required: true, select: false },
  userId: { type: String, required: true, unique: true },
  userRoll: { type: String, default: "user" },
  status: { type: String, default: "nonApproved" },
}, { timestamps: true });

module.exports = mongoose.model("users", userSchema);
