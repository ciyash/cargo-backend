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
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});
 
const sendForgotPasswordOTP = async (email, otp) => {
  try {
    await transport.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Forgot Password OTP",
      text: `Your OTP is ${otp}. It will expire in 5 minutes.`,
    });
    // console.log("OTP sent successfully");
  } catch (error) {
    // console.error("Error sending OTP:", error);
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
    subadmin.otp = otp;
    subadmin.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 mins expiry
 
    await subadmin.save();
   
 
    await sendForgotPasswordOTP(email, otp);
 
    res.status(200).json({ message: "OTP sent successfully", otp });
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
    if (!subadmin) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
 
    // Ensure OTP is a string for comparison
    if (subadmin.otp !==otp || new Date(subadmin.otpExpires) < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
 
   
    // Convert newPassword to a string before hashing
    const passwordString = String(newPassword);
    subadmin.password = await bcrypt.hash(passwordString, 10);
 
    subadmin.otp = null;
    subadmin.otpExpires = null;
 
    await subadmin.save();
 
    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
 
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
  

const signup = async (req, res) => {
  try {
    const { name, username, address, phone, email, password, branchId, location, documents, role } = req.body;

    const companyId = req.user.companyId; // ✅ extracted from token

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required in token" });
    }

    const existingEmail = await Subadmin.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "Subadmin already exists with this email" });

    const existingPhone = await Subadmin.findOne({ phone });
    if (existingPhone) return res.status(400).json({ message: "Subadmin already exists with this phone" });

    const subadminUniqueId = generateSubadminUniqueId(); // your existing function
    const hashedPassword = await bcrypt.hash(password, 10);

    const newSubadmin = new Subadmin({
      companyId,
      subadminUniqueId,
      name,
      username,
      address,
      phone,
      email,
      password: hashedPassword,
      branchId,
      location,
      documents,
      role,
    });

    await newSubadmin.save();
    res.status(201).json({ message: "Subadmin signed up successfully", subadmin: newSubadmin });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email, Phone, or Username, and password are required" });
    }

    // Find the subadmin and populate branch details
    const subadmin = await Subadmin.findOne({
      $or: [{ email: identifier }, { phone: identifier }, { username: identifier }]
    }).populate({
      path: "branchId",
      select: "branchUniqueId location name city"
    });

    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found!" });
    }

    const isMatch = await bcrypt.compare(password, subadmin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
                      req.socket?.remoteAddress ||
                      req.connection?.remoteAddress;

    await Subadmin.findByIdAndUpdate(subadmin._id, { ipAddress });

    // Ensure `branchId` and its properties exist
    const branchId = subadmin.branchId ? subadmin.branchId.branchUniqueId : null;
    const branchLocation = subadmin.branchId ? subadmin.branchId.location : "Not Assigned";
    const branchName = subadmin.branchId ? subadmin.branchId.name : "Not Assigned";
    const branchCity = subadmin.branchId ? subadmin.branchId.city : "Not Assigned"; // ✅ Fix applied

    // Create the JWT payload
    const tokenPayload = {
      subadminUniqueId: subadmin.subadminUniqueId,
      id: subadmin._id,
      role: subadmin.role,
      name:subadmin.name,
      location: subadmin.location,
      branchId,
      branchLocation,
      branchName,
      branchCity, 
      ipAddress,
    companyId: subadmin.companyId?.toString() // 
    };

    // console.log(tokenPayload)

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: "1d" });

    res.status(200).json({
      message: "Login successful",
      token,
      role: subadmin.role
    });
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
 
const changeSubadminPassword = async (req, res) => {
  try {
    const id = req.user?.id;
    if (!id) {
      return res.status(401).json({ success: false, message: "Unauthorized access" });
    }
 
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Old password and new password are required" });
    }
 
    const subadmin = await Subadmin.findById(id);
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }
 
    const isMatch = await bcrypt.compare(oldPassword, subadmin.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Incorrect old password" });
    }
 
    const isSamePassword = await bcrypt.compare(newPassword, subadmin.password);
    if (isSamePassword) {
      return res.status(400).json({ success: false, message: "New password must be different from old password" });
    }
 
    // Hash and save new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    subadmin.password = hashedPassword;
 
    // **Ensure all required fields are preserved before saving**
    await subadmin.save({ validateBeforeSave: false });
 
    res.status(200).json({message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
 
 
const getSubadminById = async (req, res) => {
  try {
   
    const id = req.user?.id; // Ensure it's extracted correctly
    if (!id) {
      return res.status(400).json({ message: "Invalid or missing subadmin ID" });
    }
 
    const subadmin = await Subadmin.findById(id).populate("branchId",'name city branchUniqueId');
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }
 
    res.status(200).json(subadmin);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
 
 
const getAllSubadmins = async (req, res) => {
  try {
    const subadmins = await Subadmin.find().populate("branchId",'name branchUniqueId branchType city location address');
 
    if (subadmins.length === 0) {
      return res.status(404).json({ message: "No subadmins in database" });
    }
 
    res.status(200).json(subadmins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
 
const getSubadminsByBranchName = async (req, res) => {
  try {
    const { branchName } = req.body; // Get branch name from request body
 
    if (!branchName) {
      return res.status(400).json({ message: "Branch name is required" });
    }
 
    // Find subadmins and populate branchId with only 'name' field
    const subadmins = await Subadmin.find().populate({
      path: "branchId",
      select: "name",
    });
 
    // Filter subadmins where branchId.name matches the given name
    const filteredSubadmins = subadmins.filter(
      (subadmin) => subadmin.branchId?.name === branchName
    );
 
    if (filteredSubadmins.length === 0) {
      return res.status(404).json({ message: "No subadmins found for this branch" });
    }
 
    res.status(200).json(filteredSubadmins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
 
const deleteSubadmin = async (req, res) => {
  try {
    const id = req.user?.id;
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

const updateSubadmin = async (req, res) => {
  try {
 
    const id = req.user?.id;
        const updateData = req.body;
 
    if (!id) {
      return res.status(400).json({ message: "Subadmin ID is required" });
    }
 
    const subadmin = await Subadmin.findById(id);
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }
 
    // Prevent updating sensitive fields like password directly
    if (updateData.password) {
      return res.status(400).json({ message: "Use change password feature to update password" });
    }
 
    const updatedSubadmin = await Subadmin.findByIdAndUpdate(id, updateData, { new: true });
 
    res.status(200).json({ message: "Subadmin updated successfully", subadmin: updatedSubadmin });
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
  getSubadminById,
  deleteSubadmin,
  updateSubadmin,
  getSubadminsByBranchName
}; 
 
                   