const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const cors = require("cors");
const socketIo = require("socket.io");
const axios = require("axios");
const { upload } = require("./Cloud/Cloudinary");
require("dotenv").config();

// ✅ MongoDB Connection
require("./DB/cofig");

// ✅ Models
const User = require("./DB/users");
const Image = require("./DB/Image");
const Video = require("./DB/Video");
const Notification = require("./DB/Notification");


// ✅ Cloudinary
const app = express();
const server = http.createServer(app);

// ✅ Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",   // React Native se connect hoga
    methods: ["GET", "POST", "PUT", "DELETE"]
  },
});

app.set("socketio", io);

// ✅ Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());



const JWT_SECRET = process.env.JWT_SECRET || "mySecretKey";

// ------------------------------------------
// 🔹 Example API: Signup
// ------------------------------------------
app.post("/signup", async (req, res) => {
  try {
    const {  email, password,profilePic ,fname, lname, } = req.body;
    if (!fname || !lname || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(409).json({ error: "Email already exists" });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Unique userId
    const userId = `user_${Date.now()}`;

    // Save user
    const user = new User({
      fname,
      lname,
      email,
      password: hashedPassword,
      profilePic: profilePic || null, // URL from Cloudinary
      userId,
      userRoll: "user",
    });

    let result = await user.save();
    result = result.toObject();
    delete result.password;

    res.status(201).json({
      message: "User registered successfully ✅",
      user: result,
    });

  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    let user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(404).json({ error: "User not found" });

    // password check
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Invalid credentials" });

    // JWT Token (userId ke sath)
    const token = jwt.sign(
      { userId: user.userId, email: user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // password remove before sending
    user = user.toObject();
    delete user.password;

    // response me userId bhejna zaroori
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        userId: user.userId,
        fname: user.fname,
        lname: user.lname,
        email: user.email,
        profilePic: user.profilePic,
        status: user.status,
        userRoll: user.userRoll,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/update-profile/:id", upload.single("file"), async (req, res) => {
    try {
        const user_id = req.params.id;
        const {userId, Fname, Lname,city,role } = req.body;
        let updateData = { Fname, Lname,city,role };

        if (req.file) {
            updateData.img = req.file.path; // ✅ Cloudinary se new image URL
        }

        const updatedUser = await User.findByIdAndUpdate(
            user_id,
            updateData,
            { new: true }
        ).select("-password"); // ✅ Password hide kar do

        res.json(updatedUser);

      await LogAction({
      userId,
      Fname:Fname,
      Lname:Lname,
      action: "Profile Update",
      description: `${Fname} ${Lname} has updated Profile.`,
      ipAddress: req.ip
    });
        

    } catch (error) {
        console.error("Profile Update Error:", error);
        res.status(500).json({ error: "Failed to update profile" });
    }
});

app.put("/change-password/:id", async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.params._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // ✅ Compare old password with hash
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Old password is incorrect" });
    }

    // ✅ Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Password Change Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: "User not found" });

        const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "10m" });

        user.resetToken = token;
        await user.save();

        // ✅ Setup email
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
               user: process.env.EMAIL_USER,
               pass: process.env.EMAIL_PASS // 🔁 app password (not your normal password)
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: "Password Reset",
            html: `<p>Click the link to reset your password:</p>
                <a href="http://localhost:3000/reset-password/${user._id}/${token}">
                    Reset Password
                </a>
                <p>This link will expire in 10 minutes.</p>`
        };

        await transporter.sendMail(mailOptions);
        res.json({ message: "Password reset link sent to your email." });
    } catch (error) {
        console.error("Forgot Password Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/storage-usage", async (req, res) => {
  try {
    // 🔍 Step 1: Check env variables
    if (!process.env.CLOUD_NAME || !process.env.CLOUD_API_KEY || !process.env.CLOUD_API_SECRET) {
      return res.status(500).json({ error: "Cloudinary environment variables are missing!" });
    }

    // 🔍 Step 2: Cloudinary Usage API Call
    const response = await axios.get(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUD_NAME}/usage`,
      {
        auth: {
          username: process.env.CLOUD_API_KEY,
          password: process.env.CLOUD_API_SECRET,
        },
      }
    );

    // 🔍 Step 3: Convert bytes → MB & GB
    const usageMB = response.data.storage.usage / (1024 * 1024); // Bytes → MB
    const limitGB = response.data.storage.limit / (1024 * 1024 * 1024); // Bytes → GB

    res.json({ usedMB: Number(usageMB.toFixed(2)), totalGB: limitGB });
  } catch (error) {
    // 🔍 Step 4: Detailed error log
    if (error.response) {
      console.error("Cloudinary API Error:", error.response.status, error.response.data);
      res.status(error.response.status).json({
        error: error.response.data || "Cloudinary API failed",
      });
    } else {
      console.error("Server Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  }
});


// 🔒 RESET PASSWORD API
app.post("/reset-password/:id/:token", async (req, res) => {
    const { id, token } = req.params;
    const { newPassword } = req.body;

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.id !== id) return res.status(401).json({ error: "Unauthorized" });

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: "User not found" });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.resetToken = null;
        await user.save();
        res.json({ message: "Password reset successful" });

    } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(400).json({ error: "Invalid or expired token" });
    }
});




// GET /user/:id
app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.id });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // password remove kar k bhejna
    const userData = user.toObject();
    delete userData.password;

    res.json(userData);
  } catch (err) {
    console.error("Fetch User Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


app.post("/images/upload", async (req, res) => {
  try {
    const { images, userId } = req.body; 
    if (!images || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const savedImages = await Image.insertMany(
  images.map((url, idx) => ({
    url,
    uploadedBy: userId || null,
    uploadedAt: new Date(Date.now() + idx), 
  }))
);
    res.status(201).json({
      message: "Images saved successfully ✅",
      images: savedImages
    });
  } catch (err) {
    console.error("Upload Images Error:", err);
    res.status(500).json({ error: "Failed to save images" });
  }
});



app.get("/images", async (req, res) => {
  try {
    const images = await Image.find().sort({ uploadedAt: -1, _id: -1 })

    res.json(images);
  } catch (err) {
    console.error("Get Images Error:", err);
    res.status(500).json({ error: "Failed to fetch images" });
  }
});




app.delete("/images/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // check if image exists
    const image = await Image.findById(id);
    if (!image) {
      return res.status(404).json({ error: "Image not found" });
    }

    // delete image from DB
    await Image.findByIdAndDelete(id);

    // TODO: agar Cloudinary se bhi delete karna ho to yaha cloudinary.uploader.destroy() call karein

    res.json({ message: "Image deleted successfully ✅", id });
  } catch (err) {
    console.error("Delete Image Error:", err);
    res.status(500).json({ error: "Failed to delete image" });
  }
});

app.put("/images/:id", async (req, res) => {
  try {
    const { uploadedAt } = req.body;
    if (!uploadedAt) return res.status(400).json({ error: "uploadedAt required" });

    const updated = await Image.findByIdAndUpdate(
      req.params.id,
      { uploadedAt: new Date(uploadedAt) },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Image not found" });

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


app.post("/videos/upload", async (req, res) => {
  try {
    const { videos } = req.body;
    if (!videos || videos.length === 0) {
      return res.status(400).json({ error: "No videos provided" });
    }

    const savedVideos = await Video.insertMany(
      videos.map(url => ({
        url,
        thumbnail: url.replace("/upload/", "/upload/so_1/").replace(".mp4", ".jpg")
      }))
    );

    res.status(201).json({
      message: "Videos saved successfully ✅",
      videos: savedVideos
    });
  } catch (err) {
    console.error("Upload Videos Error:", err);
    res.status(500).json({ error: "Failed to save videos" });
  }
});

app.get("/videos", async (req, res) => {
  try {
    const Videos = await Video.find().sort({ uploadedAt: -1 });
    res.json(Videos);
  } catch (err) {
    console.error("Get Videos Error:", err);
    res.status(500).json({ error: "Failed to fetch Videos" });
  }
});


const PORT = process.env.PORT || 4500;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
});
