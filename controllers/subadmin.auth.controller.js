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
    const { name, username,companyName, address, phone, email, password, branchId, location, documents, role } = req.body;

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
      companyName,
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
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
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
      select: "location name city"
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
    const branchId = subadmin.branchId ? subadmin.branchId._id : null;
    const branchLocation = subadmin.branchId ? subadmin.branchId.location : "Not Assigned";
    const branchName = subadmin.branchId ? subadmin.branchId.name : "Not Assigned";

    const tokenPayload = {
      subadminUniqueId: subadmin.subadminUniqueId,
      id: subadmin._id,
      role: subadmin.role,
      location:subadmin.location,
      branchId,
      branchLocation,
      branchName,
      ipAddress
    };

    // console.log("Token Payload:", tokenPayload);

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
      return res.status(404).json({ success: false, message: "Subadmin not found" });
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
    await subadmin.save();

    res.status(200).json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    // console.error("Error changing password:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};


const getSubadminById = async (req, res) => {
  try {
   
    const id = req.user?.id; // Ensure it's extracted correctly
    if (!id) {
      return res.status(400).json({ message: "Invalid or missing subadmin ID" });
    }

    const subadmin = await Subadmin.findById(id).populate("branchId",'name city');
    if (!subadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    res.status(200).json(subadmin);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};


const getAllSubadmins=async(req,res) => {
  try{
   const subadmin=await Subadmin.find()
   if(subadmin.length===0){
    return res.status(404).json({message:"No subadmins in database"})
  }
  res.status(200).json(subadmin)
  }
  catch(error){
    res.status(500).json({error:error.message})
  }
}

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
  updateSubadmin
};
 