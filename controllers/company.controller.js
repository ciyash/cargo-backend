import Company from "../models/company.model.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


// Register Subsidiary
const registerSubsidiaryCompany = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      parentCompanyId,
      phone,
      address,
      state,
      customerName
    } = req.body;

    //  const logo = req.file.buffer.toString("base64");
     const logo = req.file ? req.file.buffer.toString("base64") : "";


    const existing = await Company.findOne({ email });
    if (existing) return res.status(400).json({ msg: "Company already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newCompany = await Company.create({
      name,
      email,
      password: hashed,
      phone,
      logo,
      address,
      state,
      customerName,
      parentCompany: parentCompanyId,
      subscription: {
        plan: "monthly",
        validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    res.status(201).json({ msg: "Subsidiary registered", company: newCompany });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 

const loginCompany = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    // Check if company exists
    const company = await Company.findOne({ email }).populate("parentCompany", "name email");

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, company.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Check block status
    if (company.isBlocked) {
      return res.status(403).json({ message: "Company is blocked" });
    }

    // Save login IP
    company.lastLoginIp = ipAddress;
    await company.save();

    // Handle parentCompany ID safely
    const shopGlobalId =
      company.parentCompany && typeof company.parentCompany === "object"
        ? company.parentCompany._id?.toString()
        : company.parentCompany?.toString() || null;

    // Prepare token payload
    const tokenPayload = {
      companyId: company._id.toString(),
      email: company.email,
      shopGlobalId,
    };

    // Sign token
    const token = jwt.sign(tokenPayload, process.env.COMPANY_SECRET, {expiresIn: "1d"});

       console.log("🔐 Logged in Company ID:", tokenPayload.companyId);

    res.status(200).json({
      message: "Company logged in successfully",
      token
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const updateCompany = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.COMPANY_SECRET);
    const id = decoded.companyId; // extract from token

    const updateData = { ...req.body };

    // ✅ Handle password hashing if password is being updated
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    // ✅ Handle logo update (if a file is uploaded)
    if (req.file) {
      updateData.logo = req.file.buffer.toString("base64");
    }

    const updatedCompany = await Company.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedCompany) {
      return res.status(404).json({ msg: "Company not found" });
    }

    res.status(200).json({
      msg: "Company updated successfully",
      company: updatedCompany,
    });
  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).json({ error: err.message });
  }
};



const getAllCompanies = async (req, res) => {
  try {
    const companies = await Company.find();
    if (!companies || companies.length === 0) {
      return res.status(404).json({ msg: "No companies found" });
    }
    res.status(200).json(companies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// const setSubscription = async (req, res) => {
//   try {
//     const { plan, bookingLimit } = req.body;
//     const companyId = req.user?.companyId; // ✅ Extract from token

//     if (!companyId) {
//       return res.status(401).json({ msg: "Unauthorized: companyId missing in token" });
//     }

//     const durationMap = {
//       monthly: 30,
//       "half-yearly": 182,
//       yearly: 365,
//     };

//     if (!durationMap[plan]) {
//       return res.status(400).json({ msg: "Invalid plan" });
//     }

//     const validTill = new Date(Date.now() + durationMap[plan] * 24 * 60 * 60 * 1000);
//     const startDate = new Date();

//     const company = await Company.findByIdAndUpdate(
//       companyId,
//       {
//         subscription: {
//           plan,
//           validTill,
//           startDate,
//         },
//         bookingLimit, // ✅ Optional and dynamic
//       },
//       { new: true }
//     );

//     if (!company) return res.status(404).json({ msg: "Company not found" });

//     res.json({
//       msg: "Subscription updated successfully",
//       subscription: company.subscription,
//       bookingLimit: company.bookingLimit,
//     });
//   } catch (err) {
//     console.error("Set Subscription Error:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// };


const setSubscription = async (req, res) => {
  try {
    const { plan, bookingLimit } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ msg: "Unauthorized: companyId missing in token" });
    }

    const durationMap = {
      monthly: 30,
      "half-yearly": 182,
      yearly: 365,
    };

    if (!durationMap[plan]) {
      return res.status(400).json({ msg: "Invalid plan" });
    }

    const validTill = new Date(Date.now() + durationMap[plan] * 24 * 60 * 60 * 1000);
    const startDate = new Date();

    // 👉 Determine access based on plan
    const companyAccess = plan !== "monthly"; // only true for half-yearly and yearly

    const company = await Company.findByIdAndUpdate(
      companyId,
      {
        subscription: { plan, validTill, startDate },
        bookingLimit,
        companyAccess, // ✅ conditional value
      },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({ msg: "Company not found" });
    }

    res.json({
      msg: "Subscription updated successfully",
      subscription: company.subscription,
      bookingLimit: company.bookingLimit,
      companyAccess: company.companyAccess,
    });
  } catch (err) {
    console.error("Set Subscription Error:", err.message);
    res.status(500).json({ error: err.message });
  }
};


const checkCompanyAccess = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Company ID missing in token" });
    }

    const company = await Company.findById(companyId).select("isBlocked");
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (company.isBlocked) {
      return res.status(403).json({ message: "Access denied. Company is blocked." });
    }

    next(); // ✅ Allow to proceed
  } catch (error) {
    console.error("Access check error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};


// Get Subsidiaries
const getSubsidiaries = async (req, res) => {
  try {
    const { parentCompanyId } = req.params;
    const subsidiaries = await Company.find({ parentCompany: parentCompanyId });
    res.json({ subsidiaries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Toggle Project Access


const toggleProjectAccess = async (req, res) => {
  try {
    const { companyId, projectKey, enable } = req.body;

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ msg: "Company not found" });

    // Initialize 'projects' field if it's missing
    if (!company.projects) {
      company.projects = {};
    }

    // Set or update the project key
    company.projects[projectKey] = enable
      ? {
          enabled: true,
          membershipStartDate: new Date(),
          membershipEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        }
      : {
          enabled: false,
          membershipStartDate: null,
          membershipEndDate: null
        };

    await company.save();

    res.json({
      msg: `Access to ${projectKey} ${enable ? "enabled" : "disabled"}`,
      projects: company.projects
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// Delete Company
const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    const company = await Company.findByIdAndDelete(id);
    if (!company) {
      return res.status(404).json({ msg: "Company not found" });
    }

    res.json({ msg: "Company deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Check Membership Status
const checkMembershipStatus = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findById(companyId);

    if (!company || !company.subscription?.validTill) {
      return res.json({ hasActiveMembership: false });
    }

    const isActive = new Date(company.subscription.validTill) > new Date();

    res.json({ hasActiveMembership: isActive });
  } catch (err) {
    res.status(500).json({ hasActiveMembership: false });
  }
};

export default {
  registerSubsidiaryCompany,
  loginCompany,
  getAllCompanies,
  getSubsidiaries,
  toggleProjectAccess,
  deleteCompany,
  setSubscription,
  checkMembershipStatus,
  updateCompany,
  checkCompanyAccess
};
     