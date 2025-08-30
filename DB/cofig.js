const mongoose = require("mongoose");
require("dotenv").config();

// Agar .env me Mongo URI hai to use kare, warna local DB
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/Memories_Archiver";

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected"))
.catch((err) => console.error("❌ MongoDB Connection Error:", err));

module.exports = mongoose;
