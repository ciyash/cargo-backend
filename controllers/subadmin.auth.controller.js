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
    const {
      name,
      username,
      address,
      phone,
      email,
      password,
      branchId,
      location,
      documents,
      role
    } = req.body;

    let companyId = req.user?.companyId;

    // If companyId is not present (e.g., admin is creating new employee), fetch it from admin's DB record
    if (!companyId && req.user?._id) {
      const admin = await Subadmin.findById(req.user._id);
      if (!admin) return res.status(404).json({ message: "Admin not found" });
      companyId = admin.companyId;
    }

    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    // Check if email or phone already exists

     const existingUser = await Subadmin.findOne({ username });
    if (existingUser) return res.status(400).json({ message: "Username already registered" });


    const existingEmail = await Subadmin.findOne({ email });
    if (existingEmail) return res.status(400).json({ message: "Email already registered" });

    const existingPhone = await Subadmin.findOne({ phone });
    if (existingPhone) return res.status(400).json({ message: "Phone already registered" });

    const subadminUniqueId = generateSubadminUniqueId();
    const hashedPassword = await bcrypt.hash(password, 10);

    const finalBranchId = role === "admin" ? null : branchId;

    const newSubadmin = new Subadmin({
      companyId,
      subadminUniqueId,
      name,
      username,
      address,
      phone,
      email,
      password: hashedPassword,
      branchId: finalBranchId,
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
      return res.status(400).json({
        message: "Email, Phone, or Username, and password are required"
      });
    }

    // Find the subadmin and populate branch + company
    const subadmin = await Subadmin.findOne({
      $or: [
        { email: identifier },
        { phone: identifier },
        { username: identifier }
      ]
    })
    .populate({
      path: "branchId",
      select: "branchUniqueId location name city"
    })
    .populate({
      path: "companyId",
      select: "name code" // populate only required fields
    });
// console.log("Company Info:", subadmin.companyId);

    if (!subadmin) {
      return res.status(404).json({ message: "Employee not found!" });
    } 

    const isMatch = await bcrypt.compare(password, subadmin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
                      req.socket?.remoteAddress ||
                      req.connection?.remoteAddress;

    await Subadmin.findByIdAndUpdate(subadmin._id, { ipAddress });

    // Extract branch info
    const branch = subadmin.branchId || {};
    
    // Extract company info
    const company = subadmin.companyId || {};

    const tokenPayload = {
      subadminUniqueId: subadmin.subadminUniqueId,
      id: subadmin._id,
      role: subadmin.role,
      name: subadmin.name,
      location: subadmin.location,
      branchId: branch.branchUniqueId || null,
      branchLocation: branch.location || "Not Assigned",
      branchName: branch.name || "Not Assigned",
      branchCity: branch.city || "Not Assigned",
      ipAddress,

      // ✅ Full company details  tokenss
      companyId: company._id?.toString() || null,
      companyName: company.name || null,
      companyCode: company.code || null,
      companyShortCode: company.name?.substring(0, 2).toUpperCase() || null
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "1d"
    });

    res.status(200).json({
      message: "Login successful",
      token,
      role: subadmin.role
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      message: "Server Error",
      error: error.message
    });
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
    const id = req.user?.id;
    if (!id) {
      return res.status(400).json({ message: "Invalid or missing subadmin ID" });
    }

    const subadmin = await Subadmin.findById(id)
      .populate({
        path: 'branchId',
        select: 'name city branchUniqueId companyId',
        populate: {
          path: 'companyId',
          model: 'Company',
          select: 'name email phone subscription',
        },
      })
      .populate({
        path: 'companyId', // <-- populate the companyId directly from Subadmin schema
        model: 'Company',
        select: 'name email phone subscription',
      });

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
    const companyId = req.user?.companyId; // Get companyId from token
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    const subadmins = await Subadmin.find({ companyId, role: "admin" })
      .populate("branchId", "name branchUniqueId branchType city location address")
      .populate("companyId", "name email phone address state customerName");

    if (subadmins.length === 0) {
      return res.status(404).json({ message: "No admin subadmins in database" });
    }

    res.status(200).json(subadmins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllEmployees = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const role = req.user?.role;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Only admin can access this resource" });
    }

    const subadmins = await Subadmin.find({ companyId })
      .populate("branchId", "name branchUniqueId branchType city location address")
      .populate("companyId", "name email logo phone address state customerName");

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
    const { id } = req.params;
    const role = req.user?.role; 

    if (!id) {
      return res.status(400).json({ message: "Subadmin ID is required" });
    }

    // ✅ Only allow admin to perform this update
    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Only admin can update subadmin details" });
    }

    // ✅ Destructure all allowed fields from req.body
    const { email, phone, name, location, documents, address, password } = req.body;

    const updateData = {};

    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (name) updateData.name = name;
    if (location) updateData.location = location;
    if (documents) updateData.documents = documents;
    if (address) updateData.address = address;

    // ✅ Securely hash password if provided
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedSubadmin = await Subadmin.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedSubadmin) {
      return res.status(404).json({ message: "Subadmin not found" });
    }

    res.status(200).json({
      message: "Subadmin updated successfully",
      subadmin: updatedSubadmin,
    });

  } catch (error) {
    return res.status(500).json({ message: "Server Error", error: error.message });
  }
};



const updateAdmin = async (req, res) => {
  try {
    const id = req.user?.id;
    const role = req.user?.role;

    // ✅ Only allow users with role 'admin' to update their own profile
    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Only admin can update their profile" });
    }

    if (!id) {
      return res.status(400).json({ message: "Admin ID is missing" });
    }

    const { email, phone, name, location,branchId, address, password, documents } = req.body;

    const updateData = {};
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (name) updateData.name = name;
    if (location) updateData.location = location;
    if (address) updateData.address = address;
    if(branchId)updateData.branchId=branchId
    if (documents) updateData.documents = documents;

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedAdmin = await Subadmin.findOneAndUpdate(
      { _id: id, role: "admin" }, // Ensure only admins update their own profile
      updateData,
      { new: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({ message: "Admin not found or not authorized" });
    }

    res.status(200).json({
      message: "Admin profile updated successfully",
      admin: updatedAdmin,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



 
const deletePersons = async (req, res) => {
  try {
    
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
  getSubadminById,
  deleteSubadmin,
  updateAdmin,
  updateSubadmin,
  getSubadminsByBranchName,
  getAllEmployees,
  deletePersons
}; 
 
                   