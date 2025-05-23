import Branch from "../models/branch.model.js";

// Function to generate uniqueId
const generateUniqueId = (city, name) => {
  const cityCode = city.substring(0, 2).toUpperCase();
  const nameCode = name.substring(0, 2).toUpperCase();
  const randomNum = Math.floor(1000 + Math.random() * 9000); 
  return `${cityCode}${nameCode}${randomNum}`;
};



const createBranch = async (req, res) => {
  try {
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

    // ✅ Main branch check logic
    if (branchType === "main") {
      const existingMain = await Branch.findOne({ city, branchType: "main" });
      if (existingMain) {
        return res.status(400).json({
          success: false,
          message: "Main branch already exists in this city",
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
    const branches = await Branch.find()
    // .populate("createdBy")
    if(!branches){
      return res.status(404).json({message:"No data found in branches"})
    }
    res.status(200).json(branches);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Branch by ID
const getBranchByUniqueId = async (req, res) => {
  try {
    const { branchUniqueId } = req.params;
    const branch = await Branch.findOne({branchUniqueId}).populate("createdBy",'name location')

    if (!branch) {
       return res.status(404).json({ success: false, message: "Branch not found" });
       }

    res.status(200).json(branch);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getbranchId=async(req,res) => {
  try{
    const {id}=req.params
    const branch=await Branch.findById(id)
    if(!branch){
      return res.status(404).json({message:"branch id not found !"})
    }
    res.status(200).json(branch)
  }
  catch(error){
    res.status(500).json({error:error.message})
  }
}

// Update Branch
const updateBranch = async (req, res) => {
  try {
    const { id } = req.params;
     
    const updatedBranch = await Branch.findByIdAndUpdate(
      id,req.body,      
      { new: true }
    );

    if (!updatedBranch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    res
      .status(200)
      .json({
        success: true,
        message: "Branch updated successfully",
        data: updatedBranch,
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBranchByDateRange = async (req, res) => {
  try {
      const { startDate, endDate } = req.body;

      // Validate required fields
      if (!startDate || !endDate) {
          return res.status(400).json({ success: false, message: "Start date and end date are required" });
      }

      // Convert to Date objects
      const start = new Date(startDate);  
      const end = new Date(endDate);

      // Validate date conversion
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return res.status(400).json({ success: false, message: "Invalid date format" });
      }

      // Ensure end date includes the full day
      end.setHours(23, 59, 59, 999);

      // Query branches within date range
      const branches = await Branch.find({
          branchDate: { $gte: start, $lte: end } // Ensure correct field name
      });

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

    // Fetch all branches and populate `createdBy`
    const branches = await Branch.find().populate("createdBy", "subadminUniqueId name");

    // Filter branch where `createdBy.subadminUniqueId` matches `subadminId`
    const matchedBranch = branches.find(branch => 
      branch.createdBy && branch.createdBy.subadminUniqueId == subadminUniqueId
    );

    if (!matchedBranch) {
      return res.status(404).json({ message: "Subadmin not found or no branch assigned!" });
    }

    console.log("Matched Branch:", matchedBranch);

    res.status(200).json(matchedBranch);
  
  } catch (error) {
    console.error("Error fetching branch:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


const getBranchCity = async (req, res) => {
  try {
    const { city } = req.params;

    // Case-insensitive search for city
    const branches = await Branch.find({ city: { $regex: new RegExp(`^${city}$`, "i") } });

    if (branches.length === 0) {
      return res.status(404).json({ message: "City not found!" });
    }

    // Extract only name & branchType
    const responseData = branches.map(branch => ({
      city:branch.city,
      name: branch.name,
      branchType: branch.branchType,
      branchUniqueId:branch.branchUniqueId
    }));

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}; 

// Delete Branch
const deleteBranch = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedBranch = await Branch.findByIdAndDelete(id);

    if (!deletedBranch) {
      return res
        .status(404)
        .json({ success: false, message: "Branch not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Branch deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
  getBranchCity
};
