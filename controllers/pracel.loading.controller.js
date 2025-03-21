import ParcelLoading from "../models/pracel.loading.model.js";
import {Booking} from "../models/booking.model.js";

const generateVocherNoUnique = () => {
  return Math.floor(100000 + Math.random() * 900000);
};

const createParcel = async (req, res) => {
  const session = await ParcelLoading.startSession(); // Start a transaction session
  session.startTransaction();

  try {
    const {
      loadingType,
      fromBranch,
      toBranch,
      parcelStatus,
      vehicalNumber,
      driverName,
      driverNo,
      fromBookingDate,
      toBookingDate,
      fromCity,
      toCity,
      remarks,
      grnNo,
      lrNumber,
    } = req.body;

    //  Validate required fields
    if (
      
      !fromBranch ||
      !vehicalNumber ||
      !driverName ||
      !driverNo ||
      !fromBookingDate ||
      !toBookingDate ||
      !Array.isArray(grnNo) ||
      grnNo.length === 0 ||
      !Array.isArray(lrNumber) ||
      lrNumber.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "All required fields must be provided" });
    }

    //  Ensure that GRN numbers exist in Booking collection before proceeding
    const existingBookings = await Booking.find({
      grnNo: { $in: grnNo },
    }).session(session);
    if (existingBookings.length === 0) {
      throw new Error("No matching GRN numbers found in Booking collection.");
    }

    const vocherNoUnique = generateVocherNoUnique();
    const loadingBy = req.user.id;
    const loadingDate = new Date();

    // Create the parcel record
    const parcel = await new ParcelLoading({
      loadingType,
      vehicalNumber,
      parcelStatus,
      loadingBy,
      vocherNoUnique,
      fromBranch,
      toBranch,
      loadingDate,
      driverName,
      driverNo,
      fromBookingDate,
      toBookingDate,
      fromCity,
      toCity,
      remarks,
      grnNo,
      lrNumber,
    }).save({ session });

    //  Update all bookings in a single query
    const updateResult = await Booking.updateMany(
      { grnNo: { $in: grnNo } },
      {
        $set: {
          bookingStatus: 1,
          loadingDate: loadingDate,
        },
      },
      { session }
    );

    console.log("Updated Bookings:", updateResult.modifiedCount);

    await session.commitTransaction(); //  Commit transaction
    res
      .status(201)
      .json({
        message: "Parcel created successfully and bookings updated",
        parcel,
      });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction(); //  Abort transaction only if active
    }
    console.error("Error creating parcel:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  } finally {
    session.endSession(); // Always end session
  }
};

const createBranchToBranch = async (req, res) => {
  try {
    const {
      loadingType,
      fromBookingDate,
      toBookingDate,
      fromBranch,
      toBranch,
      lrNumber,
      grnNo,
      vehicalNumber,
      remarks,
    } = req.body;

    const vocherNoUnique = generateVocherNoUnique();
    const loadingBy = req.user.id;

    const parcel = new ParcelLoading({
      loadingType,
      vocherNoUnique,
      loadingBy,
      fromBookingDate,
      toBookingDate,
      fromBranch,
      toBranch,
      lrNumber,
      grnNo,
      vehicalNumber,
      remarks,
    });
    await parcel.save()
    res.status(201).json({message:"parcel loading successfully",parcel})
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllParcels = async (req, res) => {
  try {
    const parcels = await ParcelLoading.find();
    if (!parcels) {
      return res.status(400).json({ message: "no prcels found !" });
    }
    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getParcelVocherNoUnique = async (req, res) => {
  try {
    const { vocherNoUnique } = req.params;
    const parcels = await ParcelLoading.findOne({ vocherNoUnique });
    if (!parcels) {
      return res.status(404).json({ message: "data not found in parcels !" });
    }
    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getParcelById = async (req, res) => {
  try {
    const { id } = req.params;
    const parcel = await ParcelLoading.findById(id).populate(
      "branch",
      "branchName"
    );

    if (!parcel) return res.status(404).json({ message: "Parcel not found" });

    res.status(200).json(parcel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateParcel = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedParcel = await ParcelLoading.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedParcel)
      return res.status(404).json({ message: "Parcel not found" });

    res.status(200).json(updatedParcel);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteParcel = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedParcel = await ParcelLoading.findByIdAndDelete(id);

    if (!deletedParcel)
      return res.status(404).json({ message: "Parcel not found" });

    res.status(200).json({ message: "Parcel deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


const getParcelsByFilter = async (req, res) => {
  try {
    const { fromBranch, fromCity, toCity, fromBookingDate, toBookingDate } = req.body;

    // Construct query dynamically
    let query = {};

    if (fromBranch) query.fromBranch = fromBranch;
    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = { $in: toCity }; // Match any city in the array
    if (fromBookingDate) query.fromBookingDate = { $gte: new Date(fromBookingDate) };
    if (toBookingDate) {
      const toDate = new Date(toBookingDate);
      toDate.setHours(23, 59, 59, 999); // Extend to end of day
      query.toBookingDate = { $lte: toDate };
    }

    // Fetch parcels based on filters and select only necessary fields
    const parcels = await ParcelLoading.find(query)
      .select("grnNo vehicleNumber driverName")
      .sort({ fromBookingDate: -1 });

    if (!parcels.length) {
      return res.status(200).json({ success: true, message: "No parcels found", data: [] });
    }

    // Extract all grnNo values
    const grnNos = parcels.flatMap(parcel => parcel.grnNo); // Flatten in case of nested arrays

    // Find corresponding booking records where grnNo matches
    const bookings = await Booking.find({ grnNo: { $in: grnNos } })
      .select("lrNumber totalQuantity remarks valueOfGoods grandTotal  packages.contains") // Include contains from packages
      .lean();

    // Ensure contains is extracted from packages array
    const formattedBookings = bookings.map(booking => ({
      ...booking,
      contains: booking.packages?.map(pkg => pkg.contains) || []
    }));

    return res.status(200).json({ 
        parcelLoadingDetails: parcels, 
        bookingDetails: formattedBookings 
      })
    
  } catch (error) {
    console.error("Error fetching parcels and bookings:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



const updateAllGrnNumbers = async (req, res) => {
  try {
    const { grnNumbers, updateFields } = req.body;

    if (!grnNumbers || !Array.isArray(grnNumbers) || grnNumbers.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid or missing grnNumbers array" });
    }

    if (
      !updateFields ||
      typeof updateFields !== "object" ||
      Object.keys(updateFields).length === 0
    ) {
      return res
        .status(400)
        .json({ message: "Invalid or missing updateFields object" });
    }

    // Add `updatedAt` field to the update object
    updateFields.updatedAt = new Date();

    // Find all bookings before update
    const beforeUpdate = await Booking.find({ grnNumber: { $in: grnNumbers } });

    // Update all records matching grnNumbers with dynamic fields
    const updateResult = await Booking.updateMany(
      { grnNumber: { $in: grnNumbers } },
      { $set: updateFields }
    );

    // Fetch all updated records
    const afterUpdate = await Booking.find({ grnNumber: { $in: grnNumbers } });

    return res.status(200).json({
      message: `Successfully updated ${updateResult.modifiedCount} records`,
      beforeUpdate,
      afterUpdate,
    });
  } catch (error) {
    console.error("Error updating GRN numbers:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getParcelByLrNumber = async (req, res) => {
  try {
    const { lrNumber } = req.body;

    if (!lrNumber) {
      return res.status(400).json({ message: "lrNumber is required" });
    }

    // Fetch parcels where lrNumber matches
    const parcels = await ParcelLoading.find({ lrNumber: { $in: lrNumber } });

    // Fetch booking data separately
    const bookings = await Booking.find({ lrNumber: { $in: lrNumber } });

    if (parcels.length === 0 && bookings.length === 0) {
      return res.status(404).json({ message: "No matching data found" });
    }

    res.status(200).json({ parcels, bookings });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getParcelByGrnNo = async (req, res) => {
  try {
    const { grnNo } = req.body;

    if (!grnNo) {
      return res.status(400).json({ message: "grnNo is required" });
    }

    // Fetch parcel where grnNo matches
    const parcel = await ParcelLoading.findOne({ grnNo: grnNo });

    // Fetch booking data separately
    const booking = await Booking.findOne({ grnNumber: grnNo });

    if (!parcel && !booking) {
      return res.status(404).json({ message: "No matching data found" });
    }

    res.status(200).json({ parcel, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getParcelByVehicalNumber = async (req, res) => {
  try {
    const { vehicalNumber } = req.params;

    const parcel = await ParcelLoading.find({ vehicalNumber });

    if (parcel.length === 0) {
      return res.status(400).json({ message: "parcel not found !" });
    }

    res.status(200).json(parcel);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getParcelLoadingBetweenDates = async (req, res) => {
  try {
    const { fromBookingDate, toBookingDate } = req.body;

    if (!fromBookingDate || !toBookingDate) {
      return res
        .status(400)
        .json({ message: "fromBookingDate and toBookingDate are required!" });
    }

    const startDate = new Date(fromBookingDate);
    const endDate = new Date(toBookingDate);

    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ message: "Invalid date format!" });
    }

    endDate.setHours(23, 59, 59, 999);

    const parcels = await ParcelLoading.find({
      fromBookingDate: { $gte: startDate, $lte: endDate },
    });

    if (!parcels.length) {
      return res
        .status(404)
        .json({ message: "No parcels found in the given date range!" });
    }

    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const parcelStatusReport = async (req, res) => {
  try {
    const { startDate, endDate, fromCity, toCity, parcelStatus } = req.body;

    if (
      !startDate ||
      !endDate ||
      !fromCity ||
      !toCity ||
      parcelStatus === undefined
    ) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    // Ensure date filtering works properly
    const parcels = await ParcelLoading.find({
      fromCity,
      toCity,
      parcelStatus,
      fromBookingDate: { $gte: new Date(startDate) },
      toBookingDate: { $lte: new Date(endDate) },
    });

    if (parcels.length === 0) {
      return res.status(404).json({ message: "No parcels found" });
    }

    res.status(200).json(parcels);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const parcelPendingReport = async (req, res) => {
  try {
    const { fromCity, toCity, fromBranch, toBranch } = req.body;

    if (!fromCity || !toCity || !fromBranch || !toBranch) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    const pendingParcels = await ParcelLoading.find({
      fromCity,
      toCity,
      fromBranch,
      toBranch,
    });

    if (pendingParcels.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No pending parcels found" });
    }

    res.status(200).json(pendingParcels);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingsByDateAndBranch = async (req, res) => {
  try {
    const { fromBookingDate, toBookingDate, fromBranch } = req.body;

    if (!fromBookingDate || !toBookingDate || !fromBranch) {
      return res.status(400).json({ message: "fromBookingDate, toBookingDate, and fromBranch are required" });
    }

    const from = new Date(fromBookingDate);
    const to = new Date(toBookingDate);
    to.setHours(23, 59, 59, 999); // Extend to the end of the day

    const bookings = await Booking.find({
      bookingDate: { $gte: from, $lte: to },
      pickUpBranch: fromBranch // Fixed: Ensure you're filtering by the correct field
    }).sort({ bookingDate: -1 });

    if (bookings.length === 0) {
      return res.status(200).json({message: "No parcels available" });
    }

    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};


export default {
  createParcel,
  getParcelById,
  getAllParcels,
  getParcelVocherNoUnique,
  updateParcel,
  deleteParcel,
  getParcelsByFilter,
  updateAllGrnNumbers,
  getParcelByLrNumber,
  getParcelByVehicalNumber,
  getParcelLoadingBetweenDates,
  parcelStatusReport,
  parcelPendingReport,
  getParcelByGrnNo,
  createBranchToBranch,
  getBookingsByDateAndBranch
  
};
