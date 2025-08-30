const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const multer = require("multer");
require("dotenv").config();

// ✅ Check Environment Variables
if (!process.env.CLOUD_NAME || !process.env.CLOUD_API_KEY || !process.env.CLOUD_API_SECRET) {
    console.error("❌ Cloudinary environment variables missing!");
    process.exit(1);
}

// ✅ Cloudinary Configuration
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API_KEY,
    api_secret: process.env.CLOUD_API_SECRET,
});

// ✅ Storage Configuration with Dynamic Public ID
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: "profile_images", // ✅ Cloudinary me ye folder banta hai
        format: async (req, file) => "png", // ✅ Ensure format is PNG
        public_id: (req, file) => `${Date.now()}-${file.originalname.split(".")[0]}`, // ✅ Unique file name
    }
});

// ✅ Multer Middleware with File Size Limit (5MB)
const upload = multer({ 
    storage, 
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit 
});

module.exports = { upload, cloudinary };
