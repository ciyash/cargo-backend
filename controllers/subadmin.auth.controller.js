import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Subadmin from '../models/subadmin.auth.model.js';
import nodemailer from "nodemailer";
import dotenv from "dotenv"; 

dotenv.config();

const generateSubadminUniqueId = () => Math.floor(100000 + Math.random() * 900000).toString();

const transport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, 
  },
  tls: { rejectUnauthorized: false }, 
});
 

  console.log(process.env.EMAIL_USER)
  console.log(process.env.EMAIL_PASSWORD)

const sendForgotPasswordOTP = async (email, otp) => {   
  try {
    await transport.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Forgot Password OTP",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,  
    });
    console.log("OTP sent successfully");
  } catch (error) {
    console.log("Error sending OTP:", error);  
  }
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const subadmin = await Subadmin.findOne({ email });    
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    subadmin.resetOTP = otp;
    subadmin.otpExpires = Date.now() + 5 * 60 * 1000;
    await subadmin.save();

    await sendForgotPasswordOTP(email, otp);
    res.status(200).json({ message: "OTP sent successfully",otp });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const subadmin = await Subadmin.findOne({ email });
    if (!subadmin || subadmin.resetOTP !== otp || Date.now() > subadmin.otpExpires) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    subadmin.password = await bcrypt.hash(newPassword, 10);
    subadmin.resetOTP = null;
    subadmin.otpExpires = null; 
    await subadmin.save();
  
    res.status(200).json({ message: "Password reset successfully"});
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const signup = async (req, res) => {
  try {
    const { name, username, phone, email, password, branchId, branchName, location, documents, role } = req.body;

    const existingSubadmin = await Subadmin.findOne({ $or: [{ email }, { phone }] });
    if (existingSubadmin) {
      return res.status(400).json({ message: "Subadmin already exists with this email or phone" });
    }

    const subadminUniqueId = generateSubadminUniqueId();
    const hashedPassword = await bcrypt.hash(password, 10);

    const newSubadmin = new Subadmin({
      subadminUniqueId,
      name,
      username,
      phone,
      email,
      password: hashedPassword,
      branchId,
      branchName,
      location,
      documents,
      role,
    });

    await newSubadmin.save();
    res.status(201).json({ message: "Subadmin signed up successfully", subadmin: newSubadmin });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body; 

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/Phone and password are required" });
    }

    const subadmin = await Subadmin.findOne({ $or: [{ email: identifier }, { phone: identifier }] });

    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    const isMatch = await bcrypt.compare(password, subadmin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ipAddress = req.headers["x-forwarded-for"]
      ? req.headers["x-forwarded-for"].split(",")[0].trim()
      : req.socket?.remoteAddress || req.connection?.remoteAddress;

    await Subadmin.findByIdAndUpdate(subadmin._id, { ipAddress });

    const token = jwt.sign({ id: subadmin._id, role: subadmin.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(200).json({
      message: "Login successful",
      token,
      id: subadmin._id,
      role: subadmin.role,
      uniqueId: subadmin.subadminUniqueId,
      ipAddress,
      branch:subadmin.branchName
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const changeSubadminPassword = async (req, res) => {
  try {
    const { subadminId, oldPassword, newPassword } = req.body;

    if (!subadminId || !oldPassword || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const subadmin = await Subadmin.findById(subadminId);
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, subadmin.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Old password is incorrect" });
    }

    subadmin.password = await bcrypt.hash(newPassword, 10);
    await subadmin.save();

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const getAllSubadmins = async (req, res) => {
  try {
    const subadmins = await Subadmin.find();
    res.status(200).json(subadmins);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

const deleteSubadmin = async (req, res) => {
  try {
    const { id } = req.params;
    const subadmin = await Subadmin.findById(id);
    
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    await Subadmin.findByIdAndDelete(id);
    res.status(200).json({ message: "Subadmin deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

export default {
  signup,
  login,
  forgotPassword,
  resetPassword,
  changeSubadminPassword,
  getAllSubadmins,
  deleteSubadmin,
};
 