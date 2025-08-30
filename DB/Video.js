const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema({
  url: { type: String, required: true },        // Cloudinary video URL
  thumbnail: { type: String, required: true },  // Cloudinary thumbnail URL
  uploadedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Video", videoSchema);
