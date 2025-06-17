import ParcelUnloading from '../models/parcel.unloading.model.js'
import ParcelLoading from '../models/pracel.loading.model.js'
import {Booking} from '../models/booking.model.js'


const getParcelsLoading = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    console.log(req.user.name)
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, toCity, bookingType, bookingStatus } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "fromDate and toDate are required",  
      });
    }

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Step 1: Get GRNs from 
    const parcelData = await ParcelLoading.find({
      companyId,
      loadingDate: { $gte: start, $lte: end },
    });

   if (!parcelData || parcelData.length === 0) {
      return res.status(200).json({
      
        message: "No parcel unloading found for given date range.",
        
      });
    }

    const grnNos = parcelData.map((p) => p.grnNo).flat();
    console.log('grn',grnNos)
    const bookingFilter = {
      grnNo: { $in: grnNos },
      bookingStatus: 1,
      companyId,
    };

    if (fromCity) bookingFilter.fromCity = fromCity;
    if (toCity) bookingFilter.toCity = toCity;
    if (bookingType) bookingFilter.bookingType = bookingType;
    if (bookingStatus !== undefined) bookingFilter.bookingStatus = bookingStatus;

    const bookings = await Booking.find(bookingFilter);

    return res.status(200).json({
      data: bookings,
    });
  } catch (error) {
    console.error("Error in getParcelsLoading:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


const getParcelunLoadingByGrnNumber = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    const grnNoParam = Number(req.params.grnNo);
    if (isNaN(grnNoParam)) {
      return res.status(400).json({ message: "grnNo is required and must be a valid number" });
    }

    // Step 1: Find parcelLoading entry with given grnNo and companyId
    const parcelLoading = await ParcelLoading.findOne({
      companyId,
      grnNo: grnNoParam,
    });

    if (!parcelLoading) {
      return res.status(404).json({
        success: false,
        message: "No ParcelLoading entry found for given grnNo",
      });
    }

    // Step 2: Find booking with same grnNo and bookingStatus: 1
    const booking = await Booking.findOne({
      grnNo: grnNoParam,
      bookingStatus: 1,
      companyId,
    }).populate('bookedBy', 'name'); // if you want bookedBy name

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "No booking found for the given GRN number with bookingStatus 1.",
      });
    }

    return res.status(200).json([booking]);

  } catch (error) {
    console.error("Error in getParcelunLoadingByGrnNumber:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};  //



const generateUnloadingVoucher = () => Math.floor(10000 + Math.random() * 90000);

const createParcelUnloading = async (req, res) => {
  try {
    const { vehicalNumber, branch, lrNumber, grnNo, bookingType } = req.body;

    // Get companyId from authenticated user
    const companyId = req.user?.companyId;
    const unLoadingBy = req.user?.id;

    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    // Basic validation
    if (!vehicalNumber ) {
      return res.status(400).json({ message: "vehicalNumber,  bookingType are required" });
    }

      if (!branch) {
      return res.status(400).json({ message: " branch is required" });
    }

      if (!bookingType) {
      return res.status(400).json({ message: "bookingType is required" });
    }

    if (!grnNo || !Array.isArray(grnNo) || grnNo.length === 0) {
      return res.status(400).json({ message: "GRN numbers are required and should be a non-empty array" });
    }

    if (!lrNumber || !Array.isArray(lrNumber) || lrNumber.length === 0) {
      return res.status(400).json({ message: "LR numbers are required and should be a non-empty array" });
    }

    // Convert GRN numbers to numbers
    const grnNumbers = grnNo.map(num => Number(num));

    // Validate GRNs are valid numbers
    if (grnNumbers.some(isNaN)) {
      return res.status(400).json({ message: "All GRN numbers must be valid numbers" });
    }

    const currentDate = new Date();

    // Check if all GRNs exist within this company
    const existingBookings = await Booking.find({
      grnNo: { $in: grnNumbers },
      companyId, // <-- Filter by companyId
    });

    const existingGrnNumbers = existingBookings.map(booking => booking.grnNo);

    const missingGrnNumbers = grnNumbers.filter(grn => !existingGrnNumbers.includes(grn));

    if (missingGrnNumbers.length > 0) {
      return res.status(400).json({
        message: "Some GRN numbers do not exist in the system under your company",
        missingGrnNumbers,
      });
    }

    // Update booking status and unloading date within company scope
  await Booking.updateMany(
  {
    grnNo: { $in: grnNumbers },
    companyId,
  },
  {
    $set: {
      bookingStatus: 2,
      unloadingDate: currentDate,
      unloadingBranchname: req.user?.branchName || '',      // ← assuming `branch` is branch name
      unloadingByemp: req.user?.name || req.user?.username || '', // ← add proper fallback
    },
  }
);



    // Create a new Parcel Unloading document with companyId
    const newParcel = new ParcelUnloading({
      unLoadingVoucher: generateUnloadingVoucher(),
      unLoadingBy,
      branch,
      vehicalNumber,
      lrNumber,
      grnNo: grnNumbers,
      bookingType,
      unloadingDate: currentDate,
      companyId, // <-- store companyId here as well
    });

    await newParcel.save();

    res.status(201).json({ message: "Parcel unloading created successfully", data: newParcel });
  } catch (error) {
    console.error("Error creating parcel unloading:", error);
    res.status(500).json({ message: "Error creating parcel unloading", error: error.message });
  }
};

const getAllParcelUnloadings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    const parcels = await ParcelUnloading.find({ companyId });
    if (parcels.length === 0) {
      return res.status(404).json({ message: "No parcels found" });
    }

    res.status(200).json({ success: true, data: parcels });
  } catch (error) {
    res.status(500).json({ message: "Error fetching parcels", error: error.message });
  }
};

const getParcelUnloadingById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    const parcel = await ParcelUnloading.findOne({ _id: id, companyId });

    if (!parcel) {
      return res.status(404).json({ message: "Parcel unloading not found or unauthorized" });
    }

    res.status(200).json({ success: true, data: parcel });
  } catch (error) {
    res.status(500).json({ message: "Error fetching parcel", error: error.message });
  }
};

const getParcelsByFilters = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    const { fromDate, toDate, fromCity, toCity, branch, vehicleNo } = req.body;

    const query = { companyId }; // Add company filtering

    if (fromDate && toDate) {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);

      query.unloadingDate = { $gte: start, $lte: end }; // Use your actual date field
    }

    if (fromCity) {
      query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
    }
    if (toCity) {
      query.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };
    }
    if (branch) {
      query.branch = { $regex: new RegExp(`^${branch}$`, "i") };
    }
    if (vehicleNo) {
      query.vehicleNo = { $regex: new RegExp(`^${vehicleNo}$`, "i") };
    }

    const parcels = await ParcelUnloading.find(query);

    if (!parcels.length) {
      return res.status(404).json({ message: "No parcels found" });
    }

    res.status(200).json({ success: true, data: parcels });
  } catch (error) {
    res.status(500).json({ message: "Error fetching parcels", error: error.message });
  }
};

const getParcelUnloadingByVoucher = async (req, res) => {
  try {
    const { voucher } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    const parcel = await ParcelUnloading.findOne({
      unLoadingVoucher: voucher,
      companyId,  // company filter added
    });

    if (!parcel) {
      return res.status(404).json({ message: "Parcel unloading not found" });
    }

    res.status(200).json({ success: true, data: parcel });
  } catch (error) {
    res.status(500).json({ message: "Error fetching parcel unloading", error: error.message });
  }
};

const updateParcelUnloading = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    // Find the parcel unloading document with company check
    const parcel = await ParcelUnloading.findOne({ _id: id, companyId });

    if (!parcel) {
      return res.status(404).json({ message: "Parcel unloading not found or you don't have permission" });
    }

    // Update allowed
    Object.assign(parcel, req.body);
    await parcel.save();

    res.status(200).json({ message: "Parcel unloading updated successfully", data: parcel });
  } catch (error) {
    res.status(500).json({ message: "Error updating parcel", error: error.message });
  }
};

const deleteParcelUnloading = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ message: "Unauthorized: Company ID missing" });
    }

    const deletedParcel = await ParcelUnloading.findOneAndDelete({ _id: id, companyId });

    if (!deletedParcel) {
      return res.status(404).json({ message: "Parcel unloading not found or you don't have permission" });
    }

    res.status(200).json({ message: "Parcel unloading deleted successfully" });
  } catch (error) {
        res.status(500).json({ message: "Error deleting parcel", error: error.message });
    }
};

const getUnloadingReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, fromBranch, bookingType } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    if (!fromDate || !toDate || !fromCity || !toCity || !fromBranch) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Assuming you have a single date field to filter, like unloadingDate
    const query = {
      companyId,
      unloadingDate: { 
        $gte: new Date(fromDate + "T00:00:00.000Z"), 
        $lte: new Date(toDate + "T23:59:59.999Z") 
      },
      fromCity,
      toCity,
      branch: fromBranch,
      ...(bookingType && { bookingType })
    };

    const unloadingRecords = await ParcelUnloading.find(query);

    if (unloadingRecords.length === 0) {
      return res.status(404).json({ success: false, message: "No records found" });
    }

    res.status(200).json({ success: true, data: unloadingRecords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const parcelBranchToBranchUnloading = async (req, res) => {
  try {
    const { fromLoadingDate, toLoadingDate, fromBranch, toBranch } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    if (!fromLoadingDate || !toLoadingDate) {
      return res.status(400).json({
        success: false,
        message: "fromLoadingDate and toLoadingDate are required",
      });
    }

    const fromDate = new Date(fromLoadingDate + "T00:00:00.000Z");
    const toDate = new Date(toLoadingDate + "T23:59:59.999Z");

    // Build ParcelLoading filter
    const parcelFilter = {
      companyId,
      loadingType: "branchLoad",
      loadingDate: { $gte: fromDate, $lte: toDate },
    };

    if (fromBranch) parcelFilter.fromBranch = fromBranch;
    if (toBranch) parcelFilter.toCity = { $in: [toBranch] };

    const parcels = await ParcelLoading.find(parcelFilter);

    if (!parcels.length) {
      return res.status(200).json({
        success: true,
        message: "No parcel loadings found for given date range and conditions.",
      
      });
    }

    const grnNos = parcels.flatMap(p => Array.isArray(p.grnNo) ? p.grnNo : []);

    if (!grnNos.length) {
      return res.status(200).json({
        success: true,
        message: "No GRNs found in matched parcel loadings.",
      
      });
    }

    // Build Booking filter
    const bookingFilter = {
      companyId,
      grnNo: { $in: grnNos },
      bookingStatus: 2,
    };

    if (fromBranch) bookingFilter.pickUpBranch = fromBranch;
    if (toBranch) bookingFilter.dropBranch = toBranch;

    const bookings = await Booking.find(bookingFilter);

    return res.status(200).json({
      success: true,
      message: bookings.length ? "Bookings fetched successfully" : "No bookings found",
      data: bookings,
    });

  } catch (error) {
    console.error("Error in parcelBranchToBranchUnloading:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};




const parcelBranchToBranchUnloadingPost = async (req, res) => {
  try {
    const { fromBranch, lrNumber, grnNo, unloadBranch, remarks } = req.body;

    if (!req.user || !req.user.id || !req.user.companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User details are missing",
      });
    }

    if (!fromBranch || !lrNumber || !unloadBranch) {
      return res.status(400).json({
        success: false,
        message: "fromBranch, lrNumber, and unloadBranch are required fields",
      });
    }

    if (!grnNo || !Array.isArray(grnNo) || grnNo.length === 0) {
      return res.status(400).json({
        success: false,
        message: "GRN numbers are required and should be an array",
      });
    }

    const unLoadingBy = req.user.id;
    const companyId = req.user.companyId;

    const bookings = await Booking.find({
      companyId,
      grnNo: { $in: grnNo },
    }).lean();

    if (!bookings.length) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for the provided GRN numbers",
      });
    }

    const parcel = new ParcelUnloading({
      unLoadingVoucher: generateUnloadingVoucher(),
      unLoadingBy,
      fromBranch,
      lrNumber,
      grnNo,
      unloadBranch,
      remarks,
      companyId,
    });

    await parcel.save();

    return res.status(201).json({
      success: true,
      message: "Parcel unloading recorded successfully",
      data: parcel,
    });

  } catch (error) {
    console.error("Error processing request:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


  

export default {
    createParcelUnloading,
    getAllParcelUnloadings,
    getParcelUnloadingById,
    deleteParcelUnloading,
    updateParcelUnloading,
    getParcelunLoadingByGrnNumber,
    getParcelsByFilters,
    getParcelUnloadingByVoucher,
    getUnloadingReport,
    getParcelsLoading,
    parcelBranchToBranchUnloading,
    parcelBranchToBranchUnloadingPost
}