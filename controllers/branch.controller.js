import Branch from "../models/branch.model.js";

// Function to generate uniqueId id
const generateUniqueId = (city, name) => {
  const cityCode = city.substring(0, 2).toUpperCase();
  const nameCode = name.substring(0, 2).toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000); 
  return `${cityCode}${nameCode}${randomNum}`;
};

const createBranch = async (req, res) => {
  try {
    // Get companyId from logged in user
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID not found in user session",
      });
    }

    const {
      name,
      openingBalance,
      branchType,
      city,
      location,
      branchDate,
      branchStatus,
      address,
      phone,
      email,
      pincode,
      state,
      country,
      alternateMobile,
    } = req.body;

    if (
      !name || !branchType || !city || !location || !address ||
      !phone || !email || !pincode || !state || !country
    ) {
      return res.status(400).json({
        success: false,
        message: "Required fields are missing!",
      });
    }

    // Check main branch existence for the user's company + city
    if (branchType === "main") {
      const existingMain = await Branch.findOne({ companyId, city, branchType: "main" });
      if (existingMain) {
        return res.status(400).json({
          success: false,
          message: "Main branch already exists in this city for your company",
        });
      }
    }

    const branchUniqueId = generateUniqueId(city, name);
    const createdBy = req.user.id;

    const newBranch = new Branch({
      branchUniqueId,
      openingBalance,  
      createdBy,
      name,
      branchType,
      city,
      location,
      branchDate,
      branchStatus,
      address,
      phone,
      email,
      pincode,
      state,
      country,
      alternateMobile,
      companyId,  // from logged-in user
    });

    await newBranch.save();
    return res.status(201).json({
      success: true,
      message: "Branch created successfully",
      data: newBranch,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};


const getAllBranches = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID not found in user session",
      });
    }

    const branches = await Branch.find({ companyId });
    if ( branches.length === 0) {
      return res.status(404).json({ message: "No branches found" });
    }

    res.status(200).json(branches);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBranchByUniqueId = async (req, res) => {
  try {
    const { branchUniqueId } = req.params;
    const { companyId } = req.query;

    const query = { branchUniqueId };
    if (companyId) query.companyId = companyId;

    const branch = await Branch.findOne(query).populate("createdBy", "name location");

    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }
    res.status(200).json(branch);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getbranchId = async (req, res) => {
  try {
    const { id } = req.params;
    const branch = await Branch.findById(id);

    if (!branch) {
      return res.status(404).json({ message: "Branch ID not found!" });
    }
    res.status(200).json(branch);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;

    // Optionally, you could validate companyId here if you want strict company control
    const updatedBranch = await Branch.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedBranch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    res.status(200).json({
      success: true,
      message: "Branch updated successfully",
      data: updatedBranch,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBranch = await Branch.findByIdAndDelete(id);

    if (!deletedBranch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }

    res.status(200).json({ success: true, message: "Branch deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBranchByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, companyId } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Start date and end date are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    end.setHours(23, 59, 59, 999);

    const query = {
      branchDate: { $gte: start, $lte: end },
    };
    if (companyId) {
      query.companyId = companyId;
    }

    const branches = await Branch.find(query);
    if (branches.length === 0) {
      return res.status(404).json({ success: false, message: "No branches found in this date range" });
    }

    res.status(200).json(branches);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBranchBySubadminUniqueId = async (req, res) => {
  try {
    const { subadminUniqueId } = req.params;

    // Fetch all branches and populate createdBy
    const branches = await Branch.find().populate("createdBy", "subadminUniqueId name");

    // Find the branch where createdBy.subadminUniqueId matches
    const matchedBranch = branches.find(branch =>
      branch.createdBy && branch.createdBy.subadminUniqueId == subadminUniqueId
    );

    if (!matchedBranch) {
      return res.status(404).json({ message: "Subadmin not found or no branch assigned!" });
    }

    res.status(200).json(matchedBranch);
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getBranchCity = async (req, res) => {
  try {
    const { city } = req.params;
    const { companyId } = req.query;

    const query = { city: { $regex: new RegExp(`^${city}$`, "i") } };
    if (companyId) {
      query.companyId = companyId;
    }

    const branches = await Branch.find(query);

    if (branches.length === 0) {
      return res.status(404).json({ message: "City not found!" });
    }

    const responseData = branches.map(branch => ({
      city: branch.city,
      name: branch.name,
      branchType: branch.branchType,
      branchUniqueId: branch.branchUniqueId,
    }));

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default {
  createBranch,
  getAllBranches,
  getBranchByUniqueId,
  getbranchId,
  updateBranch,
  deleteBranch,
  getBranchByDateRange,
  getBranchBySubadminUniqueId,
  getBranchCity,
};
