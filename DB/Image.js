const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  uploadedBy: { type: String, required: false } // optional: userId save karna
});

module.exports = mongoose.model("Image", imageSchema);
