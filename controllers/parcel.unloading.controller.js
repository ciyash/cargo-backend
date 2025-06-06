import ParcelUnloading from '../models/parcel.unloading.model.js'
import ParcelLoading from '../models/pracel.loading.model.js'
import {Booking} from '../models/booking.model.js'


const getParcelsLoading = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, toCity, bookingType, bookingStatus } = req.body;

    // Validate required
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "fromDate and toDate are required",
      });
    }

    // Step 1: Get GRNs from ParcelLoading in date range
    const parcelData = await ParcelLoading.find({
      companyId,
      loadingType: "offload",
      loadingDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
    });

    if (parcelData.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No parcel unloading found for given date range.",
        data: [],
      });
    }

    // Step 2: Extract grnNo
    const grnNos = parcelData.map((p) => p.grnNo).flat();

    console.log("Extracted GRNs from ParcelLoading:", grnNos);

    // Step 3: Build Booking filter
    const bookingFilter = {
      grnNo: { $in: grnNos },
      bookingStatus: 1,
      companyId,
    };

    if (fromCity) bookingFilter.fromCity = fromCity;
    if (toCity) bookingFilter.toCity = toCity;
    if (bookingType) bookingFilter.bookingType = bookingType;
    if (bookingStatus !== undefined) bookingFilter.bookingStatus = bookingStatus;

    console.log("Booking Filter Applied:", bookingFilter);

    // Step 4: Get Bookings
    const bookings = await Booking.find(bookingFilter);

    if (bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: `No bookings found with bookingStatus: ${bookingFilter.bookingStatus} for these GRNs.`,
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      message: "Filtered Parcel Unloading bookings fetched successfully.",
      data: bookings,
    });
  } catch (error) {
    console.error("Error in parcelFilterUnloading:", error);
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

    const grnNo = Number(req.params.grnNo);
    if (isNaN(grnNo)) {
      return res.status(400).json({ message: "grnNo is required and must be a valid number" });
    }

    const booking = await Booking.aggregate([
      { 
        $match: { 
          grnNo, 
          bookingStatus: 1, 
          companyId // <-- ensure company filtering here
        } 
      },
      {
        $addFields: {
          totalQuantity: { $sum: "$packages.quantity" },
        },
      },
      {
        $group: {
          _id: "$bookingType",
          totalQuantity: { $sum: "$totalQuantity" },
          totalGrandTotal: { $sum: "$grandTotal" },
          bookings: { $push: "$$ROOT" },
        },
      },
      {
        $project: {
          bookingType: "$_id",
          totalQuantity: 1,
          totalGrandTotal: 1,
          bookings: {
            $map: {
              input: "$bookings",
              as: "booking",
              in: {
                grnNo: "$$booking.grnNo",
                lrNumber: "$$booking.lrNumber",
                fromCity: "$$booking.fromCity",
                toCity: "$$booking.toCity",
                pickUpBranch: "$$booking.pickUpBranch",
                pickUpBranchname: "$$booking.pickUpBranchname",
                dropBranch: "$$booking.dropBranch",
                dropBranchname: "$$booking.dropBranchname",
                senderName: "$$booking.senderName",
                receiverName: "$$booking.receiverName",
                bookingStatus: "$$booking.bookingStatus",
                bookingDate: "$$booking.bookingDate",
                totalQuantity: "$$booking.totalQuantity",
                grandTotal: "$$booking.grandTotal",
              },
            },
          },
        },
      },
    ]);

    if (!booking || booking.length === 0) {
      return res.status(404).json({ message: "Booking not found or doesn't match bookingStatus: 1" });
    }

    return res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    console.error("Error in getParcelunLoadingByGrnNumber:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


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
    if (!vehicalNumber || !branch || !bookingType) {
      return res.status(400).json({ message: "vehicalNumber, branch, and bookingType are required" });
    }

    if (!grnNo || !Array.isArray(grnNo) || grnNo.length === 0) {
      return res.status(400).json({ message: "GRN numbers are required and should be a non-empty array" });
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
        companyId, // <-- ensure update is scoped to company
      },
      { $set: { bookingStatus: 2, unloadingDate: currentDate } }
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

    // Validate companyId presence (authorization)
    if (!companyId) {
      return res.status(403).json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    // Validate required fields
    if (!fromLoadingDate || !toLoadingDate || !fromBranch || !toBranch) {
      return res.status(400).json({
        success: false,
        message: "fromLoadingDate, toLoadingDate, fromBranch, and toBranch are required",
      });
    }

    // Convert to ISO date with time bounds
    const fromDate = new Date(fromLoadingDate + "T00:00:00.000Z");
    const toDate = new Date(toLoadingDate + "T23:59:59.999Z");

    // Query bookings with company filter included
    const bookings = await Booking.find({
      companyId,
      loadingDate: { $gte: fromDate, $lte: toDate },
      pickUpBranch: fromBranch,
      dropBranch: toBranch,
    }).lean();

    if (!bookings.length) {
      return res.status(404).json({ success: false, message: "No bookings found" });
    }

    return res.status(200).json({ success: true, data: bookings });

  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


 const parcelBranchToBranchUnloadingPost = async (req, res) => {
  try {
    const { fromDate, toDate, branch, lrNumber, grnNo, unloadBranch, remarks } = req.body;

    if (!req.user || !req.user.branchCity || !req.user.id || !req.user.companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User details are missing",
      });
    }

    const fromCity = req.user.branchCity;
    const toCity = req.user.branchCity;
    const unLoadingBy = req.user.id;
    const companyId = req.user.companyId;

    if (!grnNo || !Array.isArray(grnNo) || grnNo.length === 0) {
      return res.status(400).json({
        success: false,
        message: "GRN numbers are required and should be an array",
      });
    }

    if (!fromDate || !toDate || !branch || !lrNumber) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    const fromBookingDate = new Date(fromDate);
    const toBookingDate = new Date(toDate);

    if (isNaN(fromBookingDate) || isNaN(toBookingDate)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use YYYY-MM-DD.",
      });
    }

    // Check if bookings exist for the given GRN numbers and company
    const bookings = await Booking.find({
      companyId,
      grnNo: { $in: grnNo },
    });

    if (!bookings.length) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for the provided GRN numbers",
      });
    }

    const parcel = new ParcelUnloading({
      unLoadingVoucher: generateUnloadingVoucher(),
      fromBookingDate,
      toBookingDate,
      unLoadingBy,
      fromCity,
      toCity,
      branch,
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