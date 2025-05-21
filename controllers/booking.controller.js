import { User, Booking } from "../models/booking.model.js";
import CFMaster from "../models/cf.master.model.js";
import ParcelLoading from "../models/pracel.loading.model.js";
import ParcelUnloading from "../models/parcel.unloading.model.js";
import Branch from "../models/branch.model.js";
import moment from "moment";

const generateGrnNumber = async () => {
  const lastBooking = await Booking.findOne().sort({ createdAt: -1 });
  return lastBooking ? lastBooking.grnNo + 1 : 1000;
};

const generateLrNumber = async (fromCity, location) => {
  try {
    const city = fromCity.substring(0, 1).toUpperCase(); // "H" for Hyderabad
    const locat = location.substring(0, 2).toUpperCase(); // "SR" for SR Nagar
    const companyName = "SK";

    const grnNumber = await generateGrnNumber(); // Global increment

    // Get current month & year in MMYY format
    const currentMonthYear = moment().format("MMYY"); // "0225" for Feb 2025

    // Find last LR number for the current month
    const lastBooking = await Booking.findOne({
      lrNumber: new RegExp(`^${companyName}${city}${locat}/\\d{4}/\\d{4}$`),
    }).sort({ createdAt: -1 });

    let sequenceNumber = 1; // Default start for new month

    if (lastBooking) {
      const lastLrNumber = lastBooking.lrNumber;
      const lastSequence = parseInt(lastLrNumber.split("/")[1], 10); // Extract 0001
      sequenceNumber = lastSequence + 1;
    }

    // Format sequence (0001, 0002, 0003...)
    const formattedSequence = String(sequenceNumber).padStart(4, "0");

    // Format GRN number (always increasing globally)
    const formattedGrn = String(grnNumber).padStart(4, "0");

    // Final LR format: "SKHSR/0001/1009"
    return `${companyName}${city}${locat}/${formattedSequence}/${formattedGrn}`;
  } catch (error) {
    throw new Error("Failed to generate LR number");
  }
};

const generateEWayBillNo = async () => {
  try {
    const today = moment().format("DDMMYYYY"); // Today's date in "06032025" format

    // Find the last booking for today
    const lastBooking = await Booking.findOne({
      eWayBillNo: new RegExp(`^EWB\\d{2}${today}$`), // Match today's eWayBillNo
    }).sort({ createdAt: -1 });

    let sequenceNumber = 1; // Start with 01 if no previous booking today

    if (lastBooking) {
      const lastEWayBillNo = lastBooking.eWayBillNo;
      const lastSequence = parseInt(lastEWayBillNo.substring(3, 5), 10); // Extract "01" from "EWB0106032025"
      sequenceNumber = lastSequence + 1;
    }

    // Format sequence (01, 02, 03...)
    const formattedSequence = String(sequenceNumber).padStart(2, "0");

    return `EWB${formattedSequence}${today}`;
  } catch (error) {
    throw new Error("Failed to generate eWayBillNo");
  }
};

const generateReceiptNumber = async () => {
  const lastBooking = await Booking.findOne().sort({ receiptNo: -1 }).lean();
  return (lastBooking?.receiptNo || 0) + 1; // If no booking exists, start from 1
};

const sanitizeInput = (input) => {
  if (typeof input === "string") {
    return input.trim().replace(/[<>&'"]/g, "");
  }
  return input;
};

const createBooking = async (req, res) => {
  try {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User data missing" });
    }

    const {
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      totalPrice,
      dispatchType,
      bookingType,
      packages,
      senderName,
      senderMobile,
      senderAddress,
      senderGst,
      actualWeight,
      receiverName,
      grandTotal,
      receiverMobile,
      receiverAddress,
      receiverGst,
      parcelGstAmount,
      vehicleNumber,
      serviceCharges,
      hamaliCharges,
      doorDeliveryCharges,
      doorPickupCharges,
      valueOfGoods,
      items,
    } = Object.fromEntries(
      Object.entries(req.body).map(([key, value]) => [
        key,
        sanitizeInput(value),
      ])
    );

    if (
      !fromCity ||
      !toCity ||
      !pickUpBranch ||
      !dropBranch ||
      !bookingType ||
      !grandTotal
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required booking fields" });
    }

    if (!senderName || !senderMobile || !receiverName || !receiverMobile) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Sender and receiver details are required",
        });
    }

    const [pickUpBranchdata, dropBranchdata] = await Promise.all([
      Branch.findOne({ branchUniqueId: pickUpBranch }).lean(),
      Branch.findOne({ branchUniqueId: dropBranch }).lean(),
    ]);

    if (!pickUpBranchdata || !dropBranchdata) {
      return res.status(404).json({ message: "Invalid branch provided" });
    }

    const pickUpBranchname = pickUpBranchdata.name;
    const dropBranchname = dropBranchdata.name;
    const pickUpBranchId = pickUpBranchdata._id;

    const location = req.user.location;
    const bookedBy = req.user.id;
    const bookingStatus = 0;
    const adminUniqueId = req.user.subadminUniqueId;

    const [grnNo, lrNumber, eWayBillNo, generatedReceiptNo] = await Promise.all(
      [
        generateGrnNumber(),
        generateLrNumber(fromCity, location),
        generateEWayBillNo(),
        generateReceiptNumber(),
      ]
    );

    const totalQuantity = packages.reduce(
      (sum, pkg) => sum + Number(pkg.quantity),
      0
    );

    const totalCharge = packages.reduce((sum, pkg) => {
      const price = Number(pkg.totalPrice) || 0;
      return sum + price;
    }, 0);

    const totalPackages = packages.length;

    const booking = new Booking({
      grnNo,
      lrNumber,
      totalCharge,
      location,
      adminUniqueId,
      bookingTime: Date.now(),
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      dispatchType,
      bookingType,
      packages,
      totalQuantity,
      totalPackages,
      senderName,
      senderMobile,
      senderAddress,
      senderGst,
      receiverName,
      receiverMobile,
      receiverAddress,
      receiverGst,
      parcelGstAmount,
      receiptNo: generatedReceiptNo,
      totalPrice,
      grandTotal,
      serviceCharges,
      hamaliCharges,
      doorDeliveryCharges,
      doorPickupCharges,
      valueOfGoods,
      bookingStatus,
      bookedBy,
      items,
      eWayBillNo,
      vehicleNumber,
      actualWeight,
      bookingDate: new Date(),
      bookbranchid: pickUpBranchId,
      pickUpBranchname,
      dropBranchname,
    });

    const savedBooking = await booking.save();

    if (savedBooking) {
      await Promise.all([
        (async () => {
          const senderExists = await User.findOne({ phone: senderMobile });
          if (!senderExists) {
            await User.create({
              name: senderName,
              phone: senderMobile,
              address: senderAddress,
              gst: senderGst,
            });
          }
        })(),
        (async () => {
          const receiverExists = await User.findOne({ phone: receiverMobile });
          if (!receiverExists) {
            await User.create({
              name: receiverName,
              phone: receiverMobile,
              address: receiverAddress,
              gst: receiverGst,
            });
          }
        })(),
      ]);
    }

    res
      .status(201)
      .json({
        success: true,
        message: "Booking created successfully",
        data: booking,
      });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: error.message });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const booking = await Booking.find();
    if (!booking) {
      return res.status(404).json({ message: "No data in bookings !" });
    }
    res.status(200).json(booking);
  } catch (error) {
    console.error("Error fetching bookings:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const getAllBookingsPages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default: Page 1
    const limit = parseInt(req.query.limit) || 10; // Default: 10 records per page
    const skip = (page - 1) * limit; // Calculate records to skip

    const totalBookings = await Booking.countDocuments();
    const totalPages = Math.ceil(totalBookings / limit);

    const bookings = await Booking.find()
      .populate("bookedBy")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    if (bookings.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No bookings found" });
    }

    //  Calculate next & previous pages
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

    //  Send response with pagination metadata
    res.status(200).json({
      success: true,
      page,
      limit,
      totalPages,
      totalBookings,
      nextPage,
      prevPage,
      bookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingByGrnNo = async (req, res) => {
  try {
    const { grnNo } = req.params;

    if (!grnNo) {
      return res
        .status(400)
        .json({ success: false, message: "grnNumber is required" });
    }

    const booking = await Booking.findOne({ grnNo }).populate(
      "bookedBy",
      "name"
    );

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingadminUniqueId = async (req, res) => {
  try {
    const { adminUniqueId } = req.params;
    const booking = await Booking.find({ adminUniqueId }).populate(
      "bookedBy",
      "name email role  username phone branchName branchId "
    );
    if (!booking) {
      return res.status(404).json({ message: "No adminUniqueId bookings !" });
    }
    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBookinglrNumber = async (req, res) => {
  try {
    const { lrNumber } = req.body;

    const booking = await Booking.findOne({ lrNumber });

    if (!booking) {
      return res
        .status(404)
        .json({ message: "No bookings found for this lrNumber!" });
    }

    res.status(200).json(booking);
  } catch (error) {
    console.error("Error fetching booking:", error);
    res.status(500).json({ error: error.message });
  }
};

const deleteBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findByIdAndDelete(id);
    if (!booking) {
      return res.status(400).json({ message: "no bookings in this id" });
    }
    res.status(200).json({ message: "booking deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateBookings = async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;

    const booking = await Booking.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });
    if (!booking) {
      return res.status(404).json({ message: "booking not found !" });
    }
    res.status(200).json({ message: "successfully update booking", booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateGRNBookings = async (req, res) => {
  try {
    const { grnNo } = req.params;
    const update = req.body;

    const booking = await Booking.findOneAndUpdate({ grnNo }, update, {
      new: true,
      runValidators: true,
    });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found!" });
    }

    res.status(200).json({ message: "Successfully updated booking", booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

const getBookingsfromCityTotoCity = async (req, res) => {
  try {
    const { fromCity, toCity } = req.params;

    if (!fromCity || !toCity) {
      return res.status(400).json({ message: "Required fields are missing !" });
    }
    const booking = await Booking.find({ fromCity, toCity });
    if (!booking) {
      return res.status(404).json({ message: "bookings not found !" });
    }
    res.status(200).json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getBookingsByAnyField = async (req, res) => {
  try {
    const { mobile, searchCustomer, grnNo, lrNumber } = req.body;

    let orConditions = [];

    // Add mobile condition (number match on sender or receiver mobile)
    if (mobile) {
      const mobileNumber = Number(mobile);
      if (!isNaN(mobileNumber)) {
        orConditions.push(
          { senderMobile: mobileNumber },
          { receiverMobile: mobileNumber }
        );
      }
    }

    // Add customer name condition (regex match on sender or receiver name)
    if (searchCustomer) {
      const nameRegex = new RegExp(searchCustomer, "i");
      orConditions.push({ senderName: nameRegex }, { receiverName: nameRegex });
    }

    // Add grnNo condition (exact match)
    if (grnNo && !isNaN(Number(grnNo))) {
      orConditions.push({ grnNo: Number(grnNo) });
    }

    // Add lrNumber condition (exact or regex match)
    if (lrNumber) {
      const lrRegex = new RegExp(lrNumber, "i");
      orConditions.push({ lrNumber: lrRegex });
    }

    if (!orConditions.length) {
      return res.status(400).json({
        success: false,
        message: "At least one valid search field is required",
      });
    }

    const bookings = await Booking.find({ $or: orConditions });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//by sudheer

const getBookingBydate = async (req, res) => {
  try {
    // Ensure req.user exists
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User data missing" });
    }

    const branchId = req.user?.branchId;
    if (!branchId) {
      return res
        .status(400)
        .json({ success: false, message: "Branch ID is missing in the token" });
    }

    // Get today's start and end time (UTC for consistency)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Find bookings by branchId and date
    const bookings = await Booking.find({
      bookbranchid: branchId,
      bookingTime: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!bookings.length) {
      return res
        .status(404)
        .json({ success: false, message: "No bookings found for today" });
    }

    res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("Error in getBookingBydate:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUsersBySearch = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ message: "Search query is required!" });
    }

    // Search in User collection
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { address: { $regex: query, $options: "i" } },
        { gst: { $regex: query, $options: "i" } },
      ],
    });

    if (users.length > 0) {
      const responseData = users.map((user) => ({
        type: "user",
        name: user.name,
        phone: user.phone,
        address: user.address,
        gst: user.gst,
      }));
      return res.status(200).json(responseData);
    }

    // If not found in User, then search in CFMaster
    const companies = await CFMaster.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { address: { $regex: query, $options: "i" } },
        { gst: { $regex: query, $options: "i" } },
      ],
    });

    if (companies.length > 0) {
      const responseData = companies.map((company) => ({
        type: "company",
        name: company.name,
        phone: company.phone,
        address: company.address,
        gst: company.gst,
      }));
      return res.status(200).json(responseData);
    }

    return res
      .status(404)
      .json({ message: "No matching users or companies found!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    if (users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No Users found" });
    }
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUserByMobile = async (req, res) => {
  try {
    const { senderMobile } = req.params;

    const users = await Booking.find({ senderMobile });

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "No users found" });
    }

    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCreditBookings = async (req, res) => {
  try {
    const creditBookings = await Booking.find({ bookingType: "credit" })
      .select("senderName senderMobile senderGst grandTotal bookingDate")
      .sort({ bookingDate: -1 }); // optional: sorts by newest first

    if (!creditBookings || creditBookings.length === 0) {
      return res.status(404).json({ success: false, message: "No credit bookings found" });
    }

    res.status(200).json({ success: true, data: creditBookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const unReceivedBookings = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, fromBranch, toBranch } =
      req.body;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required!" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999); // Ensure the full day is included

    // Build query for unreceived bookings with bookingStatus === 2
    const query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 2, // Only bookings with status 2 (e.g., "Unreceived")
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (fromBranch) query.pickUpBranch = fromBranch;
    if (toBranch) query.dropBranch = toBranch;

    // Fetch unreceived bookings
    const bookings = await Booking.find(query); // Assuming `Booking` is your Mongoose model

    // Check if no bookings were found
    if (bookings.length === 0) {
      return res.status(404).json({ message: "No unreceived bookings found!" });
    }

    return res.status(200).json({
      UnDelivery: bookings,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// const receivedBooking = async (req, res) => {
//   try {
//     const { grnNo } = req.body;
//     const name = req.user?.name; // Ensure req.user is properly populated

//     if (!grnNo) {
//       return res.status(400).json({ message: "grnNo is required!" });
//     }

//     if (!name) {
//       return res
//         .status(400)
//         .json({ message: "Delivery employee name is required!" });
//     }

//     // Find the booking first
//     const booking = await Booking.findOne({ grnNo });

//     if (!booking) {
//       return res.status(404).json({ message: "Booking not found!" });
//     }

//     // Check if the parcel is already received
//     if (booking.bookingStatus === 4) {
//       return res.status(400).json({ message: "Parcel already received!" });
//     }

//     // Update the booking if not already received
//     booking.bookingStatus = 4;
//     booking.deliveryDate = new Date();
//     booking.deliveryEmployee = name;

//     await booking.save({ validateModifiedOnly: true });

//     return res
//       .status(200)
//       .json({ message: "Booking received successfully", booking });
//   } catch (error) {
//     return res.status(500).json({ error: error.message });
//   }
// };

const receivedBooking = async (req, res) => {
  try {
    const { grnNo, receiverName, receiverMobile } = req.body;
    const name = req.user?.name; // Ensure req.user is properly populated

    // Validate required fields
    if (!grnNo) {
      return res.status(400).json({ message: "grnNo is required!" });
    }

    if (!name) {
      return res
        .status(400)
        .json({ message: "Delivery employee name is required!" });
    }

    if (!receiverName || !receiverMobile) {
      return res
        .status(400)
        .json({ message: "Receiver name and mobile number are required!" });
    }

    // Find the booking by grnNo
    const booking = await Booking.findOne({ grnNo });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found!" });
    }

    // Check if the parcel is already received
    if (booking.bookingStatus === 4) {
      return res.status(400).json({ message: "Parcel already received!" });
    }

    // Only allow receiving if bookingStatus is 2
    if (booking.bookingStatus !== 2) {
      return res.status(400).json({
        message: "Your parcel is not eligible for receiving (unloading not completed)."
      });
    }

    // Update the booking details
    booking.bookingStatus = 4;
    booking.deliveryDate = new Date();
    booking.deliveryEmployee = name;
    booking.receiverName = receiverName;
    booking.receiverMobile = receiverMobile;
    booking.deliveryBranchName = req.user.branchName || null; 

    await booking.save({ validateModifiedOnly: true });

    return res
      .status(200)
      .json({ message: "Booking received successfully", booking });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


const cancelBooking = async (req, res) => {
  try {
    const { grnNo } = req.params;
    const {
      refundCharge,
      refundAmount,
      cancelDate,
      cancelByUser,
      cancelBranch,
      cancelCity
    } = req.body;

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const booking = await Booking.findOne({ grnNo });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.bookingStatus === 4) {
      return res.status(400).json({
        message: "Booking cannot be cancelled. Parcel already received.",
      });
    }

    if (booking.bookingStatus === 5) {
      return res.status(400).json({
        message: "Booking is already cancelled.",
      });
    }

    // ✅ Proceed to cancel
    booking.bookingStatus = 5;

    // Use values from req.body if provided, otherwise fallback to req.user
    booking.cancelByUser = cancelByUser || req.user.name;
    booking.cancelBranch = cancelBranch || req.user.branch;
    booking.cancelCity = cancelCity || req.user.city;
    booking.cancelDate = cancelDate ? new Date(cancelDate) : new Date();

    if (refundCharge !== undefined) {
      booking.refundCharge = refundCharge;
    }
    if (refundAmount !== undefined) {
      booking.refundAmount = refundAmount;
    }

    await booking.save({ validateBeforeSave: false });

    res.status(200).json({
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};


// const parcelBookingReports = async (req, res) => {
//   try {
//     let { fromDate, toDate, fromCity, toCity, bookingStatus } = req.body;

//     if (!req.user) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Unauthorized: User data missing" });
//     }

//     if (!fromDate || !toDate) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Both fromDate and toDate are required." });
//     }
//     const userRole = req.user.role;
//     const userBranchId = req.user.branchId;

//     // Base query
//     let query = {};

//     if (fromDate && toDate) {
//       query.bookingDate = {
//         $gte: new Date(fromDate + "T00:00:00.000Z"),
//         $lte: new Date(toDate + "T23:59:59.999Z"),
//       };
//     }

//     // Role-specific logic
//     if (userRole === "employee") {
//       query.pickUpBranch = userBranchId;
//     } else {
//       // For admins/subadmins, allow optional filtering by branch from request body
//       if (req.body.branch) {
//         query.pickUpBranch = req.body.branch;
//       }
//     }

//     if (fromCity) query.fromCity = fromCity;
//     if (toCity) query.toCity = toCity;
//     if (bookingStatus) query.bookingStatus = Number(bookingStatus);

//     // All possible booking types
//     const bookingTypes = ["paid", "credit", "toPay", "FOC", "CLR"];

//     const result = {};

//     for (const type of bookingTypes) {
//       const typeQuery = { ...query, bookingType: type };

//       const bookings = await Booking.find(typeQuery)
//         .sort({ bookingDate: -1 })
//         .select(
//           "grnNo bookingStatus bookedBy bookingDate pickUpBranchname dropBranchname senderName receiverName packages.weight packages.actulWeight totalQuantity grandTotal hamaliCharge valueOfGoods eWayBillNo"
//         )
//         .populate({
//           path: "bookedBy",
//           select: "name",
//         });

//       let allGrandTotal = 0;
//       let allTotalQuantity = 0;

//       bookings.forEach((b) => {
//         allGrandTotal += b.grandTotal || 0;
//         allTotalQuantity += b.totalQuantity || 0;
//       });

//       result[type] = {
//         bookings,
//         allGrandTotal,
//         allTotalQuantity,
//       };
//     }

//     res.status(200).json({
//       data: result,
//     });
//   } catch (error) {
//     res
//       .status(500)
//       .json({
//         success: false,
//         message: "Error fetching bookings",
//         error: error.message,
//       });
//   }
// };


const parcelBookingReports = async (req, res) => {
  try {
    let { fromDate, toDate, fromCity, toCity, bookingStatus, bookingType } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required.",
      });
    }

    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Base query
    let query = {
      bookingDate: {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      },
    };

    if (userRole === "employee") {
      query.pickUpBranch = userBranchId;
    } else if (req.body.branch) {
      query.pickUpBranch = req.body.branch;
    }

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (bookingStatus !== undefined) query.bookingStatus = Number(bookingStatus);

    // Determine booking types to process
    const bookingTypes = bookingType ? [bookingType] : ["paid", "credit", "toPay", "FOC", "CLR"];

    const result = {};

    for (const type of bookingTypes) {
      const typeQuery = { ...query, bookingType: type };

      const bookings = await Booking.find(typeQuery)
        .sort({ bookingDate: -1 })
        .select(
          "grnNo bookingStatus bookedBy bookingDate pickUpBranchname dropBranchname senderName receiverName packages.weight packages.actulWeight totalQuantity grandTotal hamaliCharge valueOfGoods eWayBillNo"
        )
        .populate({
          path: "bookedBy",
          select: "name",
        });

      let allGrandTotal = 0;
      let allTotalQuantity = 0;

      bookings.forEach((b) => {
        allGrandTotal += b.grandTotal || 0;
        allTotalQuantity += b.totalQuantity || 0;
      });

      result[type] = {
        bookings,
        allGrandTotal,
        allTotalQuantity,
      };
    }

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    console.error("Error in parcelBookingReports:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};


const allParcelBookingReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      bookingStatus,
      vehicalNumber,
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Both startDate and endDate are required.",
      });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: "startDate should be before or equal to endDate.",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing.",
      });
    }

    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    //
    let query = {
      bookingDate: {
        $gte: new Date(startDate + "T00:00:00.000Z"),
        $lte: new Date(endDate + "T23:59:59.999Z"),
      },
    };

    if (userRole === "employee") {
      query.pickUpBranch = userBranchId;
    } else {
      if (req.body.branch) {
        query.pickUpBranch = req.body.branch;
      }
    }

    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, "i") };
    if (pickUpBranch)
      query.pickUpBranch = { $regex: new RegExp(pickUpBranch, "i") };
    if (dropBranch) query.dropBranch = { $regex: new RegExp(dropBranch, "i") };
    if (bookingStatus !== undefined)
      query.bookingStatus = Number(bookingStatus);
    if (vehicalNumber)
      query.vehicalNumber = { $regex: new RegExp(vehicalNumber, "i") };

    const bookings = await Booking.find(query).select(
      "grnNo bookingDate bookingStatus fromCity toCity bookingType pickUpBranchname dropBranchname senderName receiverName totalQuantity grandTotal hamaliCharges vehicalNumber"
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found matching the criteria.",
      });
    }

    // Group bookings by vehicalNumber
    const vehicleGrouped = {};

    bookings.forEach((booking) => {
      const vNo = booking.vehicalNumber || "Unknown";

      if (!vehicleGrouped[vNo]) {
        vehicleGrouped[vNo] = {
          vehicalNumber: vNo,
          bookings: [],
          totalQuantity: 0,
          totalGrandTotal: 0,
          totalHamaliCharge: 0,
        };
      }

      vehicleGrouped[vNo].bookings.push(booking);
      vehicleGrouped[vNo].totalQuantity += Number(booking.totalQuantity || 0);
      vehicleGrouped[vNo].totalGrandTotal += Number(booking.grandTotal || 0);
      vehicleGrouped[vNo].totalHamaliCharge += Number(
        booking.hamaliCharges || 0
      );
    });

    // Convert to array
    const groupedResult = Object.values(vehicleGrouped);

    res.status(200).json({
      message: "Bookings grouped by vehicle number.",
      data: groupedResult,
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

const parcelReportSerialNo = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity } = req.body;

    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User data missing" });
    }

    let query = {};

    // Apply branch filter only if user is an employee
    if (req.user.role === "employee") {
      query.pickUpBranch = req.user.branchId;
    }

    // Date range filter
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // Case-insensitive city filters
    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, "i") };

    const bookingTypes = ["paid", "credit", "toPay", "FOC", "CLR"];

    const result = {};
    let finalGrandTotal = 0;
    let finalTotalPackages = 0;
    let finalTotalQuantity = 0;

    for (const type of bookingTypes) {
      const typeQuery = { ...query, bookingType: type };

      const bookings = await Booking.find(typeQuery)
        .sort({ bookingDate: 1 })
        .select(
          "grnNo bookingStatus bookedBy bookingDate pickUpBranchname dropBranchname totalPackages senderName receiverName packages totalQuantity grandTotal"
        );

      let allGrandTotal = 0;
      let allTotalPackages = 0;
      let allTotalQuantity = 0;

      bookings.forEach((b) => {
        allGrandTotal += b.grandTotal || 0;
        allTotalPackages += b.totalPackages || 0;
        allTotalQuantity += b.totalQuantity || 0;
      });

      finalGrandTotal += allGrandTotal;
      finalTotalPackages += allTotalPackages;
      finalTotalQuantity += allTotalQuantity;

      result[type] = {
        bookings,
        allGrandTotal,
        allTotalPackages,
        allTotalQuantity,
      };
    }

    res.status(200).json({
      success: true,
      data: result,
      finalSummary: {
        finalGrandTotal,
        finalTotalPackages,
        finalTotalQuantity,
      },
    });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// const parcelCancelReport = async (req, res) => {
//   try {
//     const { fromDate, toDate, fromCity, toCity, bookingType } = req.body;

//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized: User data missing",
//       });
//     }

//     const userRole = req.user.role;
//     const userBranchId = req.user.branchId;

//     let query = {
//       bookingStatus: 5, // Cancelled
//     };

//     if (userRole === "employee") {
//       query.pickUpBranch = userBranchId;
//     }

//     if (fromDate && toDate) {
//       query.bookingDate = {
//         $gte: new Date(`${fromDate}T00:00:00.000Z`),
//         $lte: new Date(`${toDate}T23:59:59.999Z`),
//       };
//     }

//     if (fromCity) {
//       query.fromCity = { $regex: new RegExp(fromCity, "i") };
//     }

//     if (toCity) {
//       query.toCity = { $regex: new RegExp(toCity, "i") };
//     }

//     if (bookingType) {
//       query.bookingType = { $regex: new RegExp(bookingType, "i") };
//     }

//     const bookings = await Booking.find(query)
//       .select(
//         "bookingDate cancelDate fromCity toCity senderName reciverName totalQuantity grandTotal refundCharge refundAmount cancelByUser"
//       )
//       .sort({ bookingDate: 1 });

//     let allTotalQuantity = 0;
//     let allGrandTotal = 0;

//     const formattedData = bookings.map((booking) => {
//       allTotalQuantity += booking.totalQuantity || 0;
//       allGrandTotal += booking.grandTotal || 0;

//       return {
//         bookingDate: booking.bookingDate,
//         cancelDate: booking.cancelDate,
//         fromCity: booking.fromCity,
//         toCity: booking.toCity,
//         senderName: booking.senderName,
//         reciverName: booking.reciverName,
//         totalQuantity: booking.totalQuantity || 0,
//         grandTotal: booking.grandTotal || 0,
//         cancelCharge: booking.refundCharge || 0,
//         refundAmount: booking.refundAmount || 0,
//         cancelBy: booking.cancelByUser || "",
//       };
//     });

//     return res.status(200).json({
//       success: true,
//       data: formattedData,
//       count: bookings.length,
//       allTotalQuantity,
//       allGrandTotal,
//       message:
//         bookings.length > 0
//           ? "Cancelled bookings fetched successfully."
//           : "No cancelled bookings found.",
//     });
//   } catch (error) {
//     console.error("Error in parcelCancelReport:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error while fetching cancelled bookings.",
//       error: error.message,
//     });
//   }
// };

const parcelCancelReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, bookingType } = req.body;

    // if (!req.user) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Unauthorized: User data missing",
    //   });
    // }

    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // Base query for cancelled bookings
    let query = {
      bookingStatus: 5, // Cancelled
    };

    // // Limit employee access to their branch
    // if (userRole === "employee") {
    //   query.pickUpBranch = userBranchId;
    // }

    // Validate and apply date range
    
    // Validate and apply date range to cancelDate instead of bookingDate
if (fromDate && toDate) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({
      success: false,
      message: "Invalid date format provided.",
    });
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  query.cancelDate = { $gte: start, $lte: end }; // 👈 changed this line
}


    // Optional filters
    if (fromCity) {
      query.fromCity = { $regex: new RegExp(fromCity, "i") };
    }

    if (toCity) {
      query.toCity = { $regex: new RegExp(toCity, "i") };
    }

    if (bookingType) {
      query.bookingType = { $regex: new RegExp(bookingType, "i") };
    }

    // Fetch cancelled bookings
    const bookings = await Booking.find(query)
      .select(
        "bookingDate cancelDate fromCity toCity grnNo senderName receiverName totalQuantity grandTotal refundCharge refundAmount cancelByUser"
      )
      .sort({ bookingDate: 1 });

    // Totals
    let allTotalQuantity = 0;
    let allGrandTotal = 0;

    // Format data
    const formattedData = bookings.map((booking) => {
      allTotalQuantity += booking.totalQuantity || 0;
      allGrandTotal += booking.grandTotal || 0;

      return {
        bookingDate: booking.bookingDate,
        cancelDate: booking.cancelDate,
        fromCity: booking.fromCity,
        toCity: booking.toCity,
        grnNo: booking.grnNo,
        senderName: booking.senderName,
        receiverName: booking.receiverName,
        totalQuantity: booking.totalQuantity || 0,
        grandTotal: booking.grandTotal || 0,
        cancelCharge: booking.refundCharge || 0,
        refundAmount: booking.refundAmount || 0,
        cancelBy: booking.cancelByUser || "",
      };
    });

    // Response
    return res.status(200).json({
      success: true,
      data: formattedData,
      count: bookings.length,
      allTotalQuantity,
      allGrandTotal,
      message:
        bookings.length > 0
          ? "Cancelled bookings fetched successfully."
          : "No cancelled bookings found.",
    });
  } catch (error) {
    console.error("Error in parcelCancelReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching cancelled bookings.",
      error: error.message,
    });
  }
};

const parcelBookingSummaryReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } =
      req.body;

    let query = {};

    // Filter by date range
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // Filter by fromCity and toCity
    if (fromCity) query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };

    // Filter by pickup and drop branches
    if (pickUpBranch)
      query.pickUpBranch = { $regex: new RegExp(`^${pickUpBranch}$`, "i") };
    if (dropBranch)
      query.dropBranch = { $regex: new RegExp(`^${dropBranch}$`, "i") };

    // Fetch data from the database
    const bookings = await Booking.find(query);

    if (bookings.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: "No customer bookings found." });
    }

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching parcel booking summary report:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// const parcelBookingMobileNumber = async (req, res) => {
//   try {
//     const { fromDate, toDate, mobile, bookingType, bookingStatus, reportType } =
//       req.body;

//     if (!req.user) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Unauthorized: User data missing" });
//     }

//     let query = {};

//     if (req.user.role === "employee") {
//       query.pickUpBranch = req.user.branchId;
//     }

//     // Date rang
//     if (fromDate && toDate) {
//       query.bookingDate = {
//         $gte: new Date(`${fromDate}T00:00:00.000Z`),
//         $lte: new Date(`${toDate}T23:59:59.999Z`),
//       };
//     }

//     // Mobile filter based on reportTypeee
//     if (mobile && reportType) {
//       if (reportType === "Sender") {
//         query.senderMobile = mobile;
//       } else if (reportType === "Receiver") {
//         query.receiverMobile = mobile;
//       } else if (reportType === "ALL") {
//         query.$or = [{ senderMobile: mobile }, { receiverMobile: mobile }];
//       }
//     }

//     // Optional filters
//     if (bookingType) query.bookingType = bookingType;
//     if (bookingStatus) query.bookingStatus = bookingStatus;

//     const bookings = await Booking.find(query).select(
//       "grnNo lrNumber bookingDate pickUpBranchname fromCity toCity senderName senderMobile receiverName receiverMobile deliveryDate bookingType totalQuantity grandTotal"
//     );

//     if (!bookings.length) {
//       return res
//         .status(200)
//         .json({ success: true, message: "No customer bookings found." });
//     }

//     const allGrandTotal = bookings.reduce(
//       (sum, b) => sum + (b.grandTotal || 0),
//       0
//     );
//     const allTotalQuantity = bookings.reduce(
//       (sum, b) => sum + (b.totalQuantity || 0),
//       0
//     );

//     res.status(200).json({
//       success: true,
//       data: bookings,
//       allGrandTotal,
//       allTotalQuantity,
//     });
//   } catch (error) {
//     console.error("Error fetching parcel booking summary report:", error);
//     res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

const parcelBookingMobileNumber = async (req, res) => {
  try {
    const { fromDate, toDate, mobile, bookingType, bookingStatus, reportType } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing"
      });
    }

    let query = {};

    // Branch restriction for employees
    if (req.user.role === "employee") {
      query.pickUpBranch = req.user.branchId;
    }

    // Date range filter
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(`${fromDate}T00:00:00.000Z`),
        $lte: new Date(`${toDate}T23:59:59.999Z`)
      };
    }

    // Mobile filter
    if (mobile && reportType) {
      if (reportType === "Sender") {
        query.senderMobile = mobile;
      } else if (reportType === "Receiver") {
        query.receiverMobile = mobile;
      } else if (reportType === "ALL") {
        // Correctly apply OR condition
        query.$or = [
          { senderMobile: mobile },
          { receiverMobile: mobile }
        ];
      }
    }

    // Optional filters
    if (bookingType) query.bookingType = bookingType;
    if (bookingStatus !== undefined) query.bookingStatus = bookingStatus;

    const bookings = await Booking.find(query).select(
      "grnNo lrNumber bookingDate pickUpBranchname fromCity toCity senderName senderMobile receiverName receiverMobile deliveryDate bookingType totalQuantity grandTotal"
    );

    // If no results, return clean message
    if (!bookings.length) {
      return res.status(200).json({
        success: true,
        message: "No customer bookings found."
      });
    }

    const allGrandTotal = bookings.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const allTotalQuantity = bookings.reduce((sum, b) => sum + (b.totalQuantity || 0), 0);

    res.status(200).json({
      success: true,
      data: bookings,
      allGrandTotal,
      allTotalQuantity
    });

  } catch (error) {
    console.error("Error fetching parcel booking summary report:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


const regularCustomerBooking = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } =
      req.body;

    let query = {};

    // Date filter
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // Optional filters
    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    // Select only required fields
    const bookings = await Booking.find(query).select(
      "fromCity pickUpBranchname toCity dropBranchname bookingDate senderName senderNumber grandTotal totalQuantity"
    );

    if (bookings.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: "No customer bookings found." });
    }

    // Calculate totals
    const allGrandTotal = bookings.reduce(
      (sum, b) => sum + (b.grandTotal || 0),
      0
    );
    const allTotalQuantity = bookings.reduce(
      (sum, b) => sum + (b.totalQuantity || 0),
      0
    );

    res.status(200).json({
      data: bookings,
      allGrandTotal,
      allTotalQuantity,
    });
  } catch (error) {
    console.error("Error in regularCustomerBooking:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const branchWiseCollectionReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    /* 1️⃣  basic date validation ----------------------------------------- */
    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ error: "fromDate and toDate are required" });
    }
    const start = new Date(fromDate);
    const end   = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    /* 2️⃣  build match filter ------------------------------------------- */
    const filter = {
      bookingDate: { $gte: start, $lte: end }
    };
    if (fromCity)    filter.fromCity      = fromCity;
    if (pickUpBranch)filter.pickUpBranch  = pickUpBranch;
    if (bookedBy)    filter.bookedBy      = bookedBy;

    /* 3️⃣  aggregation --------------------------------------------------- */
    const reportData = await Booking.aggregate([
      { $match: filter },

      /* A) split normal vs cancel amounts on the fly */
      {
        $addFields: {
          isCancelled: { $eq: ["$bookingStatus", 5] },
          normalGrand: {
            $cond: [{ $eq: ["$bookingStatus", 5] }, 0, "$grandTotal"]
          },
          cancelGrand: {
            $cond: [{ $eq: ["$bookingStatus", 5] }, "$grandTotal", 0]
          }
        }
      },

      /* B) group by branch + bookingType */
      {
        $group: {
          _id: {
            branchName:  "$pickUpBranchname",
            bookingType: "$bookingType"
          },
          bookingCount:   { $sum: 1 },
          normalGrand:    { $sum: "$normalGrand" },
          cancelGrand:    { $sum: "$cancelGrand" },
          totalQty:       { $sum: "$totalQuantity" }
        }
      },

      /* C) reshape for easier consumption */
      {
        $group: {
          _id: "$_id.branchName",
          byType: {
            $push: {
              bookingType:   "$_id.bookingType",
              bookingCount:  "$bookingCount",
              grandTotal:    "$normalGrand",
              cancelAmount:  "$cancelGrand",
              totalQuantity: "$totalQty"
            }
          },
          branchGrandTotal:   { $sum: "$normalGrand" },
          branchCancelAmount: { $sum: "$cancelGrand" },
          branchTotalQty:     { $sum: "$totalQty" }
        }
      },
      {
        $project: {
          _id: 0,
          branchName:          "$_id",
          bookingTypes:        "$byType",
          branchGrandTotal:    1,
          branchCancelAmount:  1,
          branchTotalQty:      1
        }
      },
      { $sort: { branchName: 1 } }
    ]);

    if (!reportData.length) {
      return res.status(404).json({ message: "No bookings found." });
    }

    /* 4️⃣  overall totals ----------------------------------------------- */
    const totals = reportData.reduce(
      (acc, b) => {
        acc.finalGrandTotal   += b.branchGrandTotal;
        acc.finalCancelAmount += b.branchCancelAmount;
        acc.finalTotalQty     += b.branchTotalQty;
        return acc;
      },
      { finalGrandTotal: 0, finalCancelAmount: 0, finalTotalQty: 0 }
    );

    /* 5️⃣  respond ------------------------------------------------------- */
    res.status(200).json({
      branches: reportData,
      totals
    });

  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ error: err.message });
  }
};

const parcelBranchConsolidatedReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    /* ---------- 1.  Build match stage ---------- */
    const matchStage = { bookingDate: { $ne: null } };

    if (fromDate && toDate) {
      matchStage.bookingDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    if (fromCity)        matchStage.fromCity          = fromCity;
    if (pickUpBranch)    matchStage.pickUpBranchname  = pickUpBranch;
    if (bookedBy)        matchStage.bookedBy          = bookedBy;

    /* ---------- 2.  Aggregate ---------- */
    const bookingData = await Booking.aggregate([
      { $match: matchStage },

      /* A) get state of FROM city */
      {
        $lookup: {
          from: "cities",               // collection name for City
          localField: "fromCity",
          foreignField: "cityName",
          as: "fromCityData"
        }
      },
      { $unwind: { path: "$fromCityData", preserveNullAndEmptyArrays: true } },

      /* B) get state of TO city */
      {
        $lookup: {
          from: "cities",
          localField: "toCity",
          foreignField: "cityName",
          as: "toCityData"
        }
      },
      { $unwind: { path: "$toCityData", preserveNullAndEmptyArrays: true } },

      /* C) decide if both states are the same */
      {
        $addFields: {
          sameState: {
            $eq: [
              { $toLower: "$fromCityData.state" },
              { $toLower: "$toCityData.state" }
            ]
          }
        }
      },

      /* D) split GST on the fly */
      {
        $addFields: {
          igstAmount: {
            $cond: [{ $eq: ["$sameState", false] }, "$parcelGstAmount", 0]
          },
          cgstAmount: {
            $cond: [{ $eq: ["$sameState", true] },
                    { $divide: ["$parcelGstAmount", 2] }, 0]
          },
          sgstAmount: {
            $cond: [{ $eq: ["$sameState", true] },
                    { $divide: ["$parcelGstAmount", 2] }, 0]
          }
        }
      },

      /* E) group by branch / status / type */
      {
        $group: {
          _id: {
            branchName:    "$pickUpBranchname",
            bookingStatus: "$bookingStatus",
            bookingType:   "$bookingType"
          },
          count:            { $sum: 1 },
          grandTotal:       { $sum: "$grandTotal" },
          parcelGstAmount:  { $sum: "$parcelGstAmount" },
          igstAmount:       { $sum: "$igstAmount" },
          cgstAmount:       { $sum: "$cgstAmount" },
          sgstAmount:       { $sum: "$sgstAmount" }
        }
      }
    ]);

    /* ---------- 3.  Post‑aggregation shaping ---------- */
    const branchMap = {};
    const totals = {
      finalPaid: 0, finalToPay: 0, finalCredit: 0,
      finalBookingTotal: 0,
      finalTotalDelivery: 0, finalTotalCancel: 0,
      finalParcelGstAmount: 0,
      totalIgst: 0, totalCgst: 0, totalSgst: 0
    };

    for (const record of bookingData) {
      const { branchName, bookingStatus, bookingType } = record._id;

      if (!branchMap[branchName]) {
        branchMap[branchName] = {
          branchName,
          paid: 0, toPay: 0, credit: 0,
          BookingTotal: 0, booking: 0,
          delivered: 0, cancelled: 0,
          grandTotal: 0, bookingTotalAmount: 0,
          deliveredTotalAmount: 0, cancelTotalAmount: 0,
          parcelGstAmount: 0, cancelAmount: 0,
          igstAmount: 0, cgstAmount: 0, sgstAmount: 0
        };
      }
      const entry = branchMap[branchName];

      /* money by bookingType */
      if (bookingType === "paid")   { entry.paid  += record.grandTotal; totals.finalPaid  += record.grandTotal; }
      if (bookingType === "toPay")  { entry.toPay += record.grandTotal; totals.finalToPay += record.grandTotal; }
      if (bookingType === "credit") { entry.credit+= record.grandTotal; totals.finalCredit+= record.grandTotal; }

      /* GST + totals */
      entry.grandTotal       += record.grandTotal;
      entry.parcelGstAmount  += record.parcelGstAmount;
      entry.igstAmount       += record.igstAmount;
      entry.cgstAmount       += record.cgstAmount;
      entry.sgstAmount       += record.sgstAmount;

      totals.finalParcelGstAmount += record.parcelGstAmount;
      totals.totalIgst            += record.igstAmount;
      totals.totalCgst            += record.cgstAmount;
      totals.totalSgst            += record.sgstAmount;

      /* counts */
      entry.BookingTotal += record.count;
      entry.booking      += record.count;
      totals.finalBookingTotal += record.grandTotal;

      /* delivery / cancel stats */
      if (bookingStatus === 4) {
        entry.delivered            += record.count;
        entry.deliveredTotalAmount += record.grandTotal;
        totals.finalTotalDelivery  += record.grandTotal;
      }
      if (bookingStatus === 5) {
        entry.cancelled           += record.count;
        entry.cancelTotalAmount   += record.grandTotal;
        entry.cancelAmount        += record.grandTotal;
        totals.finalTotalCancel   += record.grandTotal;
      }

      entry.bookingTotalAmount = entry.grandTotal;
    }

    res.status(200).json({
      data: Object.values(branchMap),
      ...totals
    });

  } catch (err) {
    console.error("Error in parcelBranchConsolidatedReport:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

const parcelBranchWiseGSTReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, pickUpBranch } = req.body;

    // Validate required date parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide required parameters: fromDate and toDate",
      });
    }

    // Enforce the condition: if fromCity is "all" or not provided, pickUpBranch must be "all" or not provided
    const isCityAll = !fromCity || fromCity.toLowerCase() === "all";
    const isBranchAll = !pickUpBranch || pickUpBranch.toLowerCase() === "all";

    if (isCityAll && !isBranchAll) {
      return res.status(400).json({
        success: false,
        message:
          'When selecting all cities, Branch must be "select all" or omitted',
      });
    }

    // Convert dates
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    // // Log input for debugging
    // console.log('Request Body:', req.body);
    // console.log('Start Date:', startDate);
    // console.log('End Date:', endDate);

    // Build the initial $match query dynamically
    const matchQuery = {
      bookingDate: { $gte: startDate, $lte: endDate },
    };

    // Add fromCity to query only if provided and not "all"
    if (!isCityAll) {
      matchQuery.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") }; // Case-insensitive
    }

    // Add pickUpBranch to query only if provided and not "all"
    if (!isBranchAll) {
      matchQuery.pickUpBranch = pickUpBranch;
    }

    // Log the constructed query
    // console.log('Match Query:', matchQuery);

    // Test the initial match stage
    const matchedDocs = await Booking.find(matchQuery).lean();
    // console.log('Matched Documents:', matchedDocs);

    // Perform aggregation
    const [result] = await Booking.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          bookingGST: [
            {
              $match: {
                bookingType: { $in: [/^pay$/i, /^topay$/i] },
                bookingStatus: { $in: [0, 1, 2] },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$parcelGstAmount" },
                count: { $sum: 1 },
              },
            },
          ],
          deliveryGST: [
            {
              $match: {
                bookingType: { $in: [/^pay$/i, /^topay$/i] },
                bookingStatus: 4,
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$parcelGstAmount" },
                count: { $sum: 1 },
              },
            },
          ],
          creditGST: [
            {
              $match: {
                bookingType: { $regex: /^credit$/i },
                bookingStatus: { $in: [0, 1, 2, 4] },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: "$parcelGstAmount" },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    // console.log('Aggregation Result:', result);

    const bookingGST = result?.bookingGST[0] ?? { total: 0, count: 0 };
    const deliveryGST = result?.deliveryGST[0] ?? { total: 0, count: 0 };
    const creditGST = result?.creditGST[0] ?? { total: 0, count: 0 };

    const totalGST = bookingGST.total + deliveryGST.total + creditGST.total;
    const totalBookings =
      bookingGST.count + deliveryGST.count + creditGST.count;

    res.status(200).json({
      success: true,
      data: {
        bookingGST: {
          amount: bookingGST.total,
          count: bookingGST.count,
        },
        deliveryGST: {
          amount: deliveryGST.total,
          count: deliveryGST.count,
        },
        creditGST: {
          amount: creditGST.total,
          count: creditGST.count,
        },
        totalGST,
        totalBookings,
        filters: {
          fromDate,
          toDate,
          fromCity: fromCity || "all",
          pickUpBranch: pickUpBranch || "all",
        },
      },
      message: "GST breakdown calculated successfully",
    });
  } catch (error) {
    console.error("Error calculating GST breakdown:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const senderReceiverGSTReport = async (req, res) => {
  try {
    const { fromDate, toDate, branchCity, branchName } = req.body;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required" });
    }

    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    // Construct query object
    let query = {
      bookingDate: { $gte: startDate, $lte: endDate },
    };

    if (branchCity) query.fromCity = branchCity; // Add branchCity condition if provided
    if (branchName) query.pickUpBranch = branchName; // Add branchName condition if provided

    // Fetch bookings and return only required fields
    const bookings = await Booking.find(query).select(
      "grnNo bookingDate senderName receiverName bookingType ltDate senderGst reciverGst grandTotal parcelGstAmount"
    );

    if (bookings.length === 0) {
      return res
        .status(404)
        .json({ message: "No bookings found for the given criteria" });
    }
    const totalParcelGst = bookings.reduce(
      (sum, booking) => sum + (booking.parcelGstAmount || 0),
      0
    );

    res.status(200).json({ bookings, totalParcelGst });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBranchCity = async (branchUniqueId) => {
  const branch = await Branch.findOne({ branchUniqueId }).lean();
  return branch ? branch.city : null;
};

const parcelStatusDateDifferenceReport = async (req, res) => {
  try {
    const { startDate, endDate, fromCity, toCity,bookingStatus } = req.body;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ message: "startDate and endDate are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include full day

    let query = {
      bookingDate: { $gte: start, $lte: end },
      // bookingStatus: 4,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (bookingStatus) query.bookingStatus = bookingStatus;

    const bookings = await Booking.find(query).select(
      "grnNo lrNumber bookingDate loadingDate unloadingDate deliveryDate deliveryEmployee  fromCity toCity bookingStatus parcelGstAmount"
    );

    if (bookings.length === 0) {
      return res
        .status(404)
        .json({
          message: "No delivered bookings found for the given criteria",
        });
    }

    res.status(200).json({
      data: bookings,
      message: "Delivered parcel bookings report generated successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// const pendingDeliveryStockReport = async (req, res) => {
//   try {
//     const { fromCity, toCity, pickUpBranch, dropBranch } = req.body;

//     // Define filters
//     const isFromCityAll = fromCity === "all" || !fromCity;
//     const isToCityAll = toCity === "all" || !toCity;
//     const isPickUpBranchAll = pickUpBranch === "all" || !pickUpBranch;
//     const isDropBranchAll = dropBranch === "all" || !dropBranch;

//     // Query: Only bookingStatus === 2
//     const query = {
//       bookingStatus: 2,
//     };

//     if (!isFromCityAll) query.fromCity = fromCity;
//     if (!isToCityAll) query.toCity = toCity;
//     if (!isPickUpBranchAll) query.pickUpBranch = pickUpBranch;
//     if (!isDropBranchAll) query.dropBranch = dropBranch;

//     const bookings = await Booking.find(query).lean();
//     const bookingRecords = bookings.length;

//     const [result] = await Booking.aggregate([
//       { $match: query },
//       {
//         $facet: {
//           totalData: [
//             {
//               $group: {
//                 _id: null,
//                 totalRecords: { $sum: 1 },
//                 totalQuantity: { $sum: { $sum: "$packages.quantity" } },
//                 grandTotalSum: { $sum: "$grandTotal" },
//               },
//             },
//           ],
//           byBookingType: [
//             {
//               $group: {
//                 _id: "$bookingType",
//                 totalRecords: { $sum: 1 },
//                 totalQuantity: { $sum: { $sum: "$packages.quantity" } },
//                 grandTotalSum: { $sum: "$grandTotal" },
//               },
//             },
//           ],
//         },
//       },
//     ]);

//     const totalData = result.totalData[0] || {
//       totalRecords: 0,
//       totalQuantity: 0,
//       grandTotalSum: 0,
//     };

//     const byBookingTypeRaw = result.byBookingType || [];
//     const bookingTypes = ["credit", "toPay", "paid", "foc", "Free Sample"];

//     const byBookingType = {};
//     bookingTypes.forEach((type) => {
//       const data = byBookingTypeRaw.find((item) => item._id === type) || {
//         totalRecords: 0,
//         totalQuantity: 0,
//         grandTotalSum: 0,
//       };
//       byBookingType[type] = {
//         totalRecords: data.totalRecords,
//         totalQuantity: data.totalQuantity,
//         grandTotal: data.grandTotalSum,
//       };
//     });

//     // Include any other booking types
//     byBookingTypeRaw.forEach((item) => {
//       if (!byBookingType[item._id]) {
//         byBookingType[item._id] = {
//           totalRecords: item.totalRecords,
//           totalQuantity: item.totalQuantity,
//           grandTotal: item.grandTotalSum,
//         };
//       }
//     });

//     const formattedBookings = bookings.map((booking, index) => ({
//       "Sr. No": index + 1,
//       "WB No.": booking.eWayBillNo,
//       "Manual TicketNo.": booking.receiptNo,
//       "Received Date": booking.bookingDate
//         ? new Date(booking.bookingDate).toLocaleDateString()
//         : "",
//       Source: booking.fromCity,
//       grnNo: booking.grnNo,
//       Destination: booking.toCity,
//       lrNumber: booking.lrNumber,
//       Consignor: `${booking.senderName} (${booking.senderMobile || "N/A"})`,
//       Consignee: `${booking.receiverName} (${booking.receiverMobile || "N/A"})`,
//       "WB Type": booking.bookingType,
//       Amt: booking.grandTotal,
//       Pkgs: booking.totalQuantity,
//       Days: booking.bookingDate
//         ? Math.floor(
//             (new Date() - new Date(booking.bookingDate)) / (1000 * 3600 * 24)
//           )
//         : 0,
//     }));

//     res.status(200).json({
//       data: {
//         total: {
//           totalRecords: totalData.totalRecords,
//           totalQuantity: totalData.totalQuantity,
//           grandTotal: totalData.grandTotalSum,
//         },
//         byBookingType,
//         bookingRecords,
//         formattedBookings,
//         filters: {
//           fromCity: fromCity || "all",
//           toCity: toCity || "all",
//           pickUpBranch: pickUpBranch || "all",
//           dropBranch: dropBranch || "all",
//         },
//       },
//       message:
//         totalData.totalRecords > 0
//           ? "Pending delivery stock report generated"
//           : "No pending deliveries found",
//     });
//   } catch (error) {
//     console.error("Error generating pending delivery report:", error);
//     res.status(500).json({
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

const pendingDeliveryStockReport = async (req, res) => {
  try {
    const {
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      fromDate,
      toDate,
    } = req.body;

    if(!fromDate || !toDate) {  
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required" });
    }

    const isFromCityAll = fromCity === "all" || !fromCity;
    const isToCityAll = toCity === "all" || !toCity;
    const isPickUpBranchAll = pickUpBranch === "all" || !pickUpBranch;
    const isDropBranchAll = dropBranch === "all" || !dropBranch;

    
    const query = {
      bookingStatus: 2,
    };

    if (!isFromCityAll) query.fromCity = fromCity;
    if (!isToCityAll) query.toCity = toCity;
    if (!isPickUpBranchAll) query.pickUpBranch = pickUpBranch;
    if (!isDropBranchAll) query.dropBranch = dropBranch;

    // Add date filtering if provided
    if (fromDate || toDate) {
      query.bookingDate = {};
      if (fromDate) query.bookingDate.$gte = new Date(fromDate);
      if (toDate) query.bookingDate.$lte = new Date(toDate);
    }

    const bookings = await Booking.find(query).lean();
    const bookingRecords = bookings.length;

    const [result] = await Booking.aggregate([
      { $match: query },
      {
        $facet: {
          totalData: [
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                totalQuantity: { $sum: { $sum: "$packages.quantity" } },
                grandTotalSum: { $sum: "$grandTotal" },
              },
            },
          ],
          byBookingType: [
            {
              $group: {
                _id: "$bookingType",
                totalRecords: { $sum: 1 },
                totalQuantity: { $sum: { $sum: "$packages.quantity" } },
                grandTotalSum: { $sum: "$grandTotal" },
              },
            },
          ],
        },
      },
    ]);

    const totalData = result.totalData[0] || {
      totalRecords: 0,
      totalQuantity: 0,
      grandTotalSum: 0,
    };

    const byBookingTypeRaw = result.byBookingType || [];
    const bookingTypes = ["credit", "toPay", "paid", "foc", "Free Sample"];

    const byBookingType = {};
    bookingTypes.forEach((type) => {
      const data = byBookingTypeRaw.find((item) => item._id === type) || {
        totalRecords: 0,
        totalQuantity: 0,
        grandTotalSum: 0,
      };
      byBookingType[type] = {
        totalRecords: data.totalRecords,
        totalQuantity: data.totalQuantity,
        grandTotal: data.grandTotalSum,
      };
    });

    // Include any other booking types
    byBookingTypeRaw.forEach((item) => {
      if (!byBookingType[item._id]) {
        byBookingType[item._id] = {
          totalRecords: item.totalRecords,
          totalQuantity: item.totalQuantity,
          grandTotal: item.grandTotalSum,
        };
      }
    });

    const formattedBookings = bookings.map((booking, index) => ({
      "Sr. No": index + 1,
      "WB No.": booking.eWayBillNo,
      "Manual TicketNo.": booking.receiptNo,
      "Received Date": booking.bookingDate
        ? new Date(booking.bookingDate).toLocaleDateString()
        : "",
      Source: booking.fromCity,
      grnNo: booking.grnNo,
      Destination: booking.toCity,
      lrNumber: booking.lrNumber,
      Consignor: `${booking.senderName} (${booking.senderMobile || "N/A"})`,
      Consignee: `${booking.receiverName} (${booking.receiverMobile || "N/A"})`,
      "WB Type": booking.bookingType,
      Amt: booking.grandTotal,
      Pkgs: booking.totalQuantity,
      Days: booking.bookingDate
        ? Math.floor(
            (new Date() - new Date(booking.bookingDate)) / (1000 * 3600 * 24)
          )
        : 0,
    }));

 res.status(200).json({
  data: {
     message:
    totalData.totalRecords > 0
      ? "Pending delivery stock report generated"
      : `No data found for the selected filters${!isFromCityAll ? ` (fromCity: ${fromCity})` : ""}${!isToCityAll ? ` (toCity: ${toCity})` : ""}${!isPickUpBranchAll ? ` (pickUpBranch: ${pickUpBranch})` : ""}${!isDropBranchAll ? ` (dropBranch: ${dropBranch})` : ""}`,

    total: {
      totalRecords: totalData.totalRecords,
      totalQuantity: totalData.totalQuantity,
      grandTotal: totalData.grandTotalSum,
    },
    byBookingType,
    bookingRecords,
    formattedBookings,
    filters: {
      fromCity: fromCity || "all",
      toCity: toCity || "all",
      pickUpBranch: pickUpBranch || "all",
      dropBranch: dropBranch || "all",
      fromDate: fromDate || null,
      toDate: toDate || null,
    },
  },
 });

  } catch (error) {
    console.error("Error generating pending delivery report:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};


const pendingDeliveryLuggageReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      bookingType,
    } = req.body;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 2,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;
    if (bookingType) query.bookingType = bookingType;

    const pendingDeliveries = await Booking.find(query)
      .select(
        "grnNo unloadingDate fromCity toCity senderName senderMobile receiverName bookingType packages"
      )
      .lean();

    if (!pendingDeliveries.length) {
      return res.status(404).json({
        message: "No pending deliveries found for the given criteria",
      });
    }

    let serial = 1;
    const formattedDeliveries = [];
    let grandTotalQuantity = 0;
    let grandTotalAmount = 0;

    for (const delivery of pendingDeliveries) {
      const {
        grnNo,
        unloadingDate,
        fromCity,
        toCity,
        senderName,
        senderMobile,
        receiverName,
        bookingType,
        packages,
      } = delivery;

      let totalQuantity = 0;
      let totalAmount = 0;
      let itemNameFields = {};

      if (Array.isArray(packages)) {
        packages.forEach((pkg, index) => {
          const quantity = pkg.quantity || 0;
          const amount = pkg.totalPrice || 0;

          totalQuantity += quantity;
          totalAmount += amount;

          const fieldName = `itemName${index + 1}`;
          itemNameFields[fieldName] = `${pkg.packageType} (${quantity})`;
        });
      }

      grandTotalQuantity += totalQuantity;
      grandTotalAmount += totalAmount;

      formattedDeliveries.push({
        srNo: serial++,
        grnNo,
        receiverDate:
          unloadingDate
            ? new Date(unloadingDate).toLocaleDateString("en-GB")
            : "NA",
        source: fromCity,
        destination: toCity,
        consignor: senderName,
        consignee: receiverName,
        consigneeNo: senderMobile,
        bookingType,
        dayDiff: 0,
        ...itemNameFields, // dynamically spread itemName1, itemName2, etc.
        quantity: totalQuantity,
        amount: totalAmount,
      });
    }

    res.status(200).json({
      message: "Pending delivery luggage report generated successfully",
      data: formattedDeliveries,
      grandTotalQuantity,
      grandTotalAmount,
    });
  } catch (error) {
    console.error("Error generating pending delivery report:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};



const parcelReceivedStockReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      receiverName,
    } = req.body;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 4, // Delivered
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;
    if (receiverName) query.receiverName = receiverName;

    const bookings = await Booking.find(query)
      .select(
        "grnNo lrNumber deliveryDate unloadingDate senderName senderMobile bookingType bookingStatus receiverName fromCity pickUpBranch packages"
      )
      .lean();

    if (!bookings.length) {
      return res
        .status(404)
        .json({ message: "No deliveries found for the given criteria" });
    }

    let totalGrandTotal = 0;
    const updatedDeliveries = [];

    // Initialize bookingType summary for both types
    const bookingTypeSummary = {
      paid: {
        fromCity: "",
        pickupbranchname: "",
        totalAmount: 0,
      },
      toPay: {
        fromCity: "",
        pickupbranchname: "",
        totalAmount: 0,
      },
    };

    let finalTotalTopay = 0;
    let finalTotalpaid = 0;

    for (const delivery of bookings) {
      const grandTotal =
        delivery.packages?.reduce(
          (sum, pkg) => sum + (pkg.totalPrice || 0),
          0
        ) || 0;
      totalGrandTotal += grandTotal;

      updatedDeliveries.push({
        _id: delivery._id,
        grnNo: delivery.grnNo,
        lrNumber: delivery.lrNumber,
        bookingType: delivery.bookingType,
        senderName: delivery.senderName,
        senderMobile: delivery.senderMobile,
        receiverName: delivery.receiverName,
        bookingStatus: delivery.bookingStatus,
        unloadingDate: delivery.unloadingDate,
        deliveryDate: delivery.deliveryDate,
        totalPackages: delivery.packages?.length || 0,
        grandTotal,
      });

      const type = delivery.bookingType;
      if (bookingTypeSummary[type]) {
        if (!bookingTypeSummary[type].fromCity) {
          bookingTypeSummary[type].fromCity = delivery.fromCity || "";
        }
        if (!bookingTypeSummary[type].pickupbranchname) {
          bookingTypeSummary[type].pickupbranchname =
            delivery.pickUpBranch || "";
        }
        bookingTypeSummary[type].totalAmount += grandTotal;
      }

      if (type === "toPay") finalTotalTopay += grandTotal;
      if (type === "paid") finalTotalpaid += grandTotal;
    }

    return res.status(200).json({
      data: updatedDeliveries,
      totalGrandTotal,
      bookingType: bookingTypeSummary,
      finalTotalTopay,
      finalTotalpaid,
    });
  } catch (error) {
    console.error("Error in parcelReceivedStockReport:", error);
    return res.status(500).json({ error: error.message });
  }
};

const deliveredStockReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } =
      req.body;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 4,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    const stockReport = await Booking.find(query)
      .select(
        "grnNo lrNumber deliveryEmployee senderName senderMobile bookingType receiverName packages.packageType packages.quantity packages.totalPrice parcelGstAmount totalPackages serviceCharge hamaliCharge doorDeliveryCharge doorPickupCharge"
      )
      .lean();

    if (stockReport.length === 0) {
      return res
        .status(404)
        .json({ message: "No stock found for the given criteria" });
    }

    let totalGrandTotal = 0;
    let totalGST = 0;
    let totalOtherCharges = 0;
    let bookingWiseDetails = { paid: 0, toPay: 0, credit: 0 };

    const updatedDeliveries = stockReport.map((delivery) => {
      const packages = delivery.packages || [];

      // Compute package-wise fields
      const packageFields = {};
      let grandTotal = 0;

      packages.forEach((pkg, index) => {
        const quantity = pkg.quantity || 0;
        const price = pkg.totalPrice || 0;

        grandTotal += price;

        const fieldName = `package${index + 1}`;
        packageFields[fieldName] = `${pkg.packageType} (${quantity})`;
      });

      const gst = delivery.parcelGstAmount || 0;
      totalGST += gst;

      const otherCharges =
        (delivery.serviceCharge || 0) +
        (delivery.hamaliCharge || 0) +
        (delivery.doorDeliveryCharge || 0) +
        (delivery.doorPickupCharge || 0);
      totalOtherCharges += otherCharges;

      totalGrandTotal += grandTotal;

      if (delivery.bookingType === "paid")
        bookingWiseDetails.paid += grandTotal;
      if (delivery.bookingType === "toPay")
        bookingWiseDetails.toPay += grandTotal;
      if (delivery.bookingType === "credit")
        bookingWiseDetails.credit += grandTotal;

      return {
        grnNo: delivery.grnNo,
        lrNumber: delivery.lrNumber,
        deliveryEmployee: delivery.deliveryEmployee,
        senderName: delivery.senderName,
        senderMobile: delivery.senderMobile,
        bookingType: delivery.bookingType,
        receiverName: delivery.receiverName,
        totalPackages: packages.length,
        grandTotal,
        gst,
        otherCharges,
        ...packageFields,
      };
    });

    const paidNetAmount =
      bookingWiseDetails.paid + totalGST + totalOtherCharges;
    const toPayNetAmount =
      bookingWiseDetails.toPay + totalGST + totalOtherCharges;
    const creditNetAmount =
      bookingWiseDetails.credit + totalGST + totalOtherCharges;

    return res.status(200).json({
      message: "Delivered stock report generated successfully",
      data: updatedDeliveries,
      totalGrandTotal,
      totalGST,
      totalOtherCharges,
      bookingWiseDetails,
      paidNetAmount,
      toPayNetAmount,
      creditNetAmount,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// const pendingDispatchStockReport = async (req, res) => {
//   try {
//     const { fromCity, toCity, pickUpBranch } = req.body;

//     let query = { bookingStatus: 2 };

//     if (fromCity && fromCity !== "all") query.fromCity = fromCity;
//     if (toCity && toCity !== "all") query.toCity = toCity;
//     if (pickUpBranch && pickUpBranch !== "all") query.pickUpBranch = pickUpBranch;

//     const dispatchReport = await Booking.find(query)
//       .select(
//         "_id grnNo lrNumber totalPackages fromCity receiptNo bookingDate pickUpBranchname toCity deliveryEmployee vehicalNumber senderName bookingStatus receiverMobile bookingType receiverName hamaliCharge grandTotal packages"
//       )
//       .lean();

//     if (!dispatchReport.length) {
//       return res.status(404).json({
//         message: "No pending deliveries found for the given criteria",
//       });
//     }

//     const bookingTypeData = {
//       foc: [],
//       paid: [],
//       toPay: [],
//       credit: [],
//       freeSample: [],
//       other: [],
//     };

//     const bookings = [];
//     let allTotalPackages = 0;
//     let allTotalWeight = 0;
//     let totalGrandTotalAmount = 0;

//     for (const item of dispatchReport) {
//       const weight = item.packages?.reduce((sum, pkg) => sum + (pkg.weight || 0), 0) || 0;
//       allTotalPackages += item.totalPackages || 0;
//       allTotalWeight += weight;
//       totalGrandTotalAmount += item.grandTotal || 0;

//       const bookingType = (item.bookingType || "other").toLowerCase();
//       const bookingRow = {
//         lrNumber: item.lrNumber,
//         totalWeight: weight,
//         grandTotal: item.grandTotal || 0,
//       };

//       if (bookingTypeData[bookingType]) {
//         bookingTypeData[bookingType].push(bookingRow);
//       } else {
//         bookingTypeData.other.push(bookingRow);
//       }

//       // Prepare booking detail row
//       bookings.push({
//         wbNo: item.lrNumber,
//         pkgs: item.totalPackages || 0,
//         destination: item.toCity,
//         sender: item.senderName,
//         receiver: item.receiverName,
//         receiverNo: item.receiverMobile,
//         wbType: bookingType.charAt(0).toUpperCase() + bookingType.slice(1),
//         amount: item.grandTotal || 0,
//         source: item.pickUpBranchname,
//         receiptNo: item.receiptNo || "-",
//         bookingDate: item.bookingDate,
//         days: Math.max(0, Math.floor((new Date() - new Date(item.bookingDate)) / (1000 * 60 * 60 * 24)))
//       });
//     }

//     const bookingSummary = Object.entries(bookingTypeData).reduce((acc, [type, entries]) => {
//       const noa = entries.reduce((sum, e) => sum + 1, 0);
//       const totalLR = noa;
//       const actualWeight = entries.reduce((sum, e) => sum + (e.totalWeight || 0), 0);
//       const chargeWeight = 0; // Modify if you calculate it elsewhere
//       const totalAmount = entries.reduce((sum, e) => sum + (e.grandTotal || 0), 0);

//       acc[type] = {
//         noa,
//         totalLR,
//         actualWeight,
//         chargeWeight,
//         totalAmount
//       };
//       return acc;
//     }, {});

//     return res.status(200).json({
//       bookings, 
//       summary: bookingSummary, // top grouped summary
//       allTotalPackages,
//       allTotalWeight,
//       totalGrandTotalAmount
//     });
//   } catch (error) {
//     console.error("Error in pendingDispatchStockReport:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };

const pendingDispatchStockReport = async (req, res) => {
  try {
    const { fromCity, toCity, pickUpBranch, fromDate, toDate } = req.body;

    // Validate required fields
    if (!fromDate || !toDate) {
      return res.status(400).json({
        message: "Both fromDate and toDate are required.",
      });
    }

    let query = {
      bookingDate: {
        $gte: new Date(`${fromDate}T00:00:00.000Z`),
        $lte: new Date(`${toDate}T23:59:59.999Z`)
      }
    };

    if (fromCity && fromCity !== "all") query.fromCity = fromCity;
    if (toCity && toCity !== "all") query.toCity = toCity;
    if (pickUpBranch && pickUpBranch !== "all") query.pickUpBranch = pickUpBranch;

    const dispatchReport = await Booking.find(query)
      .select(
        "_id grnNo lrNumber totalPackages fromCity receiptNo bookingDate pickUpBranchname toCity deliveryEmployee vehicalNumber senderName bookingStatus receiverMobile bookingType receiverName hamaliCharge grandTotal packages"
      )
      .lean();

    if (!dispatchReport.length) {
      return res.status(404).json({
        message: "No pending deliveries found for the given criteria",
      });
    }

    const bookingTypeData = {
      foc: [],
      paid: [],
      toPay: [],
      credit: [],
      freeSample: [],
      other: [],
    };

    const bookings = [];
    let allTotalPackages = 0;
    let allTotalWeight = 0;
    let totalGrandTotalAmount = 0;

    for (const item of dispatchReport) {
      const weight = item.packages?.reduce((sum, pkg) => sum + (pkg.weight || 0), 0) || 0;
      allTotalPackages += item.totalPackages || 0;
      allTotalWeight += weight;
      totalGrandTotalAmount += item.grandTotal || 0;

      const bookingType = (item.bookingType || "other").toLowerCase();
      const bookingRow = {
        lrNumber: item.lrNumber,
        totalWeight: weight,
        grandTotal: item.grandTotal || 0,
      };

      if (bookingTypeData[bookingType]) {
        bookingTypeData[bookingType].push(bookingRow);
      } else {
        bookingTypeData.other.push(bookingRow);
      }

      // Prepare booking detail row
      bookings.push({
        wbNo: item.lrNumber,
        pkgs: item.totalPackages || 0,
        destination: item.toCity,
        sender: item.senderName,
        receiver: item.receiverName,
        receiverNo: item.receiverMobile,
        wbType: bookingType.charAt(0).toUpperCase() + bookingType.slice(1),
        amount: item.grandTotal || 0,
        source: item.pickUpBranchname,
        receiptNo: item.receiptNo || "-",
        bookingDate: item.bookingDate,
        days: Math.max(0, Math.floor((new Date() - new Date(item.bookingDate)) / (1000 * 60 * 60 * 24)))
      });
    }

    const bookingSummary = Object.entries(bookingTypeData).reduce((acc, [type, entries]) => {
      const noa = entries.length;
      const totalLR = noa;
      const actualWeight = entries.reduce((sum, e) => sum + (e.totalWeight || 0), 0);
      const chargeWeight = 0; // Modify if you calculate it elsewhere
      const totalAmount = entries.reduce((sum, e) => sum + (e.grandTotal || 0), 0);

      acc[type] = {
        noa,
        totalLR,
        actualWeight,
        chargeWeight,
        totalAmount
      };
      return acc;
    }, {});

    return res.status(200).json({
      bookings,
      summary: bookingSummary,
      allTotalPackages,
      allTotalWeight,
      totalGrandTotalAmount
    });
  } catch (error) {
    console.error("Error in pendingDispatchStockReport:", error);
    return res.status(500).json({ error: error.message });
  }
};


const dispatchedMemoReport = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      vehicalNumber,
      bookingStatus,
    } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        message: "fromDate and toDate are required",
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: bookingStatus !== undefined ? bookingStatus : 1,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;
    if (vehicalNumber) query.vehicalNumber = vehicalNumber;

    const stockReport = await Booking.find(query)
      .select(
        "_id grnNo lrNumber vehicalNumber toCity serviceCharge hamaliCharge grandTotal senderName receiverName senderMobile loadingDate bookingDate bookingType packages.packageType packages.quantity parcelGstAmount totalPackages"
      )
      .lean();

    let totalPaid = { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 };
    let totalToPay = { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 };
    let totalCredit = { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 };

    let groupedData = {
      paid: [],
      toPay: [],
      credit: [],
    };

    let cityWise = {}; // { cityName: { paidQty, paidAmount, toPayQty, toPayAmount, creditQty, creditAmount } }

    for (const item of stockReport) {
      const type = item.bookingType?.toLowerCase();
      const city = item.toCity || "Unknown";

      item.serviceCharge = item.serviceCharge || 0;
      item.hamaliCharge = item.hamaliCharge || 0;
      const totalAmount = item.grandTotal || 0;
      const qty = item.totalPackages || 1;

      // Initialize city if not exists
      if (!cityWise[city]) {
        cityWise[city] = {
          paidQty: 0,
          paidAmount: 0,
          toPayQty: 0,
          toPayAmount: 0,
          creditQty: 0,
          creditAmount: 0,
        };
      }

      if (type === "paid") {
        groupedData.paid.push(item);
        totalPaid.grandTotal += totalAmount;
        totalPaid.serviceCharge += item.serviceCharge;
        totalPaid.hamaliCharge += item.hamaliCharge;

        cityWise[city].paidQty += qty;
        cityWise[city].paidAmount += totalAmount;

      } else if (type === "topay" || type === "to pay") {
        groupedData.toPay.push(item);
        totalToPay.grandTotal += totalAmount;
        totalToPay.serviceCharge += item.serviceCharge;
        totalToPay.hamaliCharge += item.hamaliCharge;

        cityWise[city].toPayQty += qty;
        cityWise[city].toPayAmount += totalAmount;

      } else if (type === "credit") {
        groupedData.credit.push(item);
        totalCredit.grandTotal += totalAmount;
        totalCredit.serviceCharge += item.serviceCharge;
        totalCredit.hamaliCharge += item.hamaliCharge;

        cityWise[city].creditQty += qty;
        cityWise[city].creditAmount += totalAmount;
      }
    }

    const cityWiseArray = Object.entries(cityWise).map(([city, values], index) => ({
      srNo: index + 1,
      cityName: city,
      paidQty: values.paidQty,
      paidAmount: values.paidAmount,
      toPayQty: values.toPayQty,
      toPayAmount: values.toPayAmount,
      creditForQty: values.creditQty,
      creditForAmount: values.creditAmount,
    }));

    return res.status(200).json({
      data: groupedData,
      totalPaid,
      totalToPay,
      totalCredit,
      cityWiseDetails: cityWiseArray,
    });
  } catch (error) {
    console.error("Error in dispatchedMemoReport:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const parcelIncomingLuggagesReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

    if (!fromDate || !toDate) {
      return res
        .status(400)
        .json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 1,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    const stockReport = await Booking.find(query)
      .select(
        "grnNo lrNumber deliveryEmployee senderName senderMobile vehicalNumber loadingDate bookingDate bookingType receiverName receiverMobile packages.packageType packages.quantity grandTotal"
      )
      .lean();

    if (stockReport.length === 0) {
      return res
        .status(404)
        .json({ message: "No stock found for the given criteria" });
    }

    const totalGrandTotal = stockReport.reduce(
      (sum, record) => sum + (record.grandTotal || 0),
      0
    );

    // Calculate total quantity
    const totalQuantity = stockReport.reduce((total, record) => {
      if (Array.isArray(record.packages)) {
        for (const pkg of record.packages) {
          total += pkg.quantity || 0;
        }
      }
      return total;
    }, 0);

    res.status(200).json({
      data: stockReport,
      totalGrandTotal,
      totalQuantity,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const getBookingByGrnOrLrNumber = async (req, res) => {
  try {
    const { grnlrn } = req.body;

    if (!grnlrn || typeof grnlrn !== "string") {
      return res.status(400).json({
        message:
          "Please provide grnlrn (grnNo or lrNumber) as a string in the request body",
      });
    }

    const orConditions = [];

    // If grnlrn is numeric, include grnNo
    if (/^\d+$/.test(grnlrn)) {
      orConditions.push({ grnNo: parseInt(grnlrn) });
    }

    // Always check lrNumber as string
    orConditions.push({ lrNumber: grnlrn });

    const [booking, parcelLoading, parcelUnloading] = await Promise.all([
      Booking.findOne({ $or: orConditions }),
      ParcelLoading.findOne({ $or: orConditions }),
      ParcelUnloading.findOne({ $or: orConditions }),
    ]);

    return res.status(200).json({
      booking: booking || {},
      parcelLoading: parcelLoading || {},
      parcelUnloading: parcelUnloading || {},
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

// dashborad reports

const getAllBookingsAbove700 = async (req, res) => {
  try {
    // Find bookings with grandTotal greater than 700
    const bookings = await Booking.find({ grandTotal: { $gt: 700 } });

    // If no bookings found
    if (bookings.length === 0) {
      return res
        .status(404)
        .json({ message: "No bookings found with grandTotal above 700" });
    }

    // Return the found bookings
    return res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings above 700:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

const salesSummaryByBranchWise = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res
        .status(400)
        .json({ message: "Date is required in request body." });
    }

    // Parse the date from dd-mm-yyyy format to a Date range
    const [day, month, year] = date.split("-");
    const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    const bookings = await Booking.aggregate([
      {
        $match: {
          bookingDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$pickUpBranch",
          credit: {
            $sum: { $cond: [{ $eq: ["$bookingType", "credit"] }, 1, 0] },
          },
          toPay: {
            $sum: { $cond: [{ $eq: ["$bookingType", "toPay"] }, 1, 0] },
          },
          paid: {
            $sum: { $cond: [{ $eq: ["$bookingType", "paid"] }, 1, 0] },
          },
          CLR: {
            $sum: { $cond: [{ $eq: ["$bookingType", "CLR"] }, 1, 0] },
          },
          FOC: {
            $sum: { $cond: [{ $eq: ["$bookingType", "FOC"] }, 1, 0] },
          },
          totalBookings: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "branches",
          localField: "_id",
          foreignField: "branchUniqueId",
          as: "branchDetails",
        },
      },
      {
        $unwind: {
          path: "$branchDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 1,
          credit: 1,
          toPay: 1,
          paid: 1,
          CLR: 1,
          FOC: 1,
          totalBookings: 1,
          pickUpBranchName: {
            $cond: [
              { $ifNull: ["$branchDetails.name", false] },
              "$branchDetails.name",
              "No branch",
            ],
          },
        },
      },
    ]);

    if (bookings.length === 0) {
      return res
        .status(200)
        .json({ message: "No bookings found for the given date." });
    }

    res.status(200).json(bookings);
  } catch (err) {
    console.error("Error fetching branch-wise bookings:", err);
    res.status(500).json({ message: "Server error" });
  }
};

const collectionSummaryReport = async (req, res) => {
  try {
    const { selectedDate } = req.body;

    const startDate = moment(selectedDate, "DD-MM-YYYY").startOf("day").toDate();
    const endDate = moment(selectedDate, "DD-MM-YYYY").endOf("day").toDate();

    const summary = await Booking.aggregate([
      {
        $match: {
          bookingDate: { $gte: startDate, $lte: endDate },
          bookingType: { $in: ["paid", "toPay"] }, // Only include 'paid' and 'toPay'
        },
      },
      {
        $group: {
          _id: "$bookingType",
          totalBookings: { $sum: 1 },
        },
      },
      {
        $project: {
          bookingType: "$_id",
          totalBookings: 1,
          _id: 0,
        },
      },
    ]);

    const bookingTypes = ["paid", "toPay"];
    bookingTypes.forEach((type) => {
      if (!summary.find((item) => item.bookingType === type)) {
        summary.push({ bookingType: type, totalBookings: 0 });
      }
    });

    const totalBookingsForDay = summary.reduce(
      (acc, item) => acc + item.totalBookings,
      0
    );

    res.json({
      summary,
      totalBookingsForDay,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching booking summary" });
  }
};


const branchAccount = async (req, res) => {
  try {
    const { date } = req.body;

    const matchStage = {};

    // If `data` (date filter) is provided
    if (date) {
      const [day, month, year] = date.split("-"); // e.g., "16-04-2025"
      const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);
      matchStage.bookingDate = { $gte: start, $lte: end };
    }

    const result = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            pickUpBranch: "$pickUpBranch",
            pickUpBranchname: "$pickUpBranchname",
          },
          grandTotal: { $sum: "$grandTotal" },
        },
      },
      {
        $project: {
          _id: 0,
          pickUpBranch: "$_id.pickUpBranch",
          pickUpBranchname: "$_id.pickUpBranchname",
          grandTotal: 1,
        },
      },
    ]);

    const totalAmount = result.reduce((sum, item) => sum + item.grandTotal, 0);

    res.json({
      branchwise: result,
      totalAmount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching branch totals" });
  }
};

const acPartyAccount = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res
        .status(400)
        .json({ message: "Date is required in request body." });
    }

    // Parse the date into start and end time
    const [day, month, year] = date.split("-");
    const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    // Step 1: Get senderNames from the Booking model based on the date
    const bookings = await Booking.aggregate([
      {
        $match: {
          bookingDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$senderName",
          grandTotal: { $sum: "$grandTotal" },
        },
      },
      {
        $project: {
          _id: 0,
          senderName: "$_id",
          grandTotal: 1,
        },
      },
    ]);

    if (bookings.length === 0) {
      return res.json({ message: "No bookings found for the given date." });
    }

    // Step 2: Get valid senderNames (name field) from CFMaster
    const cfMasters = await CFMaster.find({}, { name: 1 });
    const validSenderNames = cfMasters.map((cf) => cf.name);

    // Step 3: Filter bookings to only include those matching senderNames from CFMaster
    const filtered = bookings.filter((b) =>
      validSenderNames.includes(b.senderName)
    );

    if (filtered.length === 0) {
      return res.json({
        message: "No matching senderName found in CFMaster for this date.",
      });
    }

    // Step 4: Calculate totalAmount
    const totalAmount = filtered.reduce(
      (sum, item) => sum + item.grandTotal,
      0
    );

    res.json({
      parties: filtered,
      totalAmount,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Server error while processing party accounts." });
  }
};


const statusWiseSummary = async (req, res) => {
  try {
    const result = await Booking.aggregate([
      {
        $group: {
          _id: "$pickUpBranchname",
          booking: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 0] }, 1, 0],
            },
          },
          loading: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 1] }, 1, 0],
            },
          },
          unloading: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 2] }, 1, 0],
            },
          },
          missing: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 3] }, 1, 0],
            },
          },
          delivered: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 4] }, 1, 0],
            },
          },
          cancelled: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 5] }, 1, 0],
            },
          },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          branch: "$_id",
          booking: 1,
          loading: 1,
          unloading: 1,
          missing: 1,
          delivered: 1,
          cancelled: 1,
          total: 1,
        },
      },
    ]);

    return res.status(200).json({
      branchwiseStatus: result,
    });
  } catch (error) {
    console.error("Error in getBranchwiseBookingStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching booking status.",
    });
  }
};



const getTotalByBranchAndDate = async (req, res) => {
  try {
    const { bookingDate, pickupBranch } = req.body;

    if (!bookingDate) {
      return res.status(400).json({ message: 'bookingDate is required' });
    }

    const startDate = new Date(bookingDate);
    const endDate = new Date(bookingDate);
    endDate.setDate(endDate.getDate() + 1);

    const matchStage = {
      bookingDate: {
        $gte: startDate,
        $lt: endDate
      }
    };

    // Fix field name to match actual DB field: pickUpBranch
    if (pickupBranch) {
      matchStage.pickUpBranch = pickupBranch;
    }

    const bookings = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$pickUpBranch', // fix here too
          total: { $sum: '$grandTotal' } // fixed: no need to double
        }
      }
    ]);

    if (bookings.length === 0) {
      return res.status(404).json({ message: 'No bookings found for this date' });
    }

    res.status(200).json({ results: bookings });
  } catch (error) {
    console.error('Error getting totals:', error);
    res.status(500).json({ message: 'Server error' });
  }
};



  
export default {
  createBooking,
  getAllBookings,
  getBookingByGrnNo,
  deleteBookings,
  updateBookings,
  getBookingadminUniqueId,
  updateGRNBookings,
  getBookinglrNumber,
  updateAllGrnNumbers,
  getBookingsfromCityTotoCity,
  getAllBookingsPages,
  getBookingsByAnyField,

  getUserByMobile,
  getAllUsers,
  getUsersBySearch,
  getCreditBookings,
  getBookingBydate,
  unReceivedBookings,
  receivedBooking,
  cancelBooking,

  // Reports

  parcelBookingReports,
  allParcelBookingReport,
  parcelReportSerialNo,
  parcelCancelReport,
  parcelBookingSummaryReport,
  parcelBookingMobileNumber,
  regularCustomerBooking,
  branchWiseCollectionReport,
  parcelBranchConsolidatedReport,
  parcelBranchWiseGSTReport,
  senderReceiverGSTReport,
  pendingDeliveryStockReport,
  parcelStatusDateDifferenceReport,
  pendingDeliveryLuggageReport,
  parcelReceivedStockReport,
  deliveredStockReport,
  pendingDispatchStockReport,
  dispatchedMemoReport,
  parcelIncomingLuggagesReport,
  getBookingByGrnOrLrNumber,

  // dashboard reports
  getAllBookingsAbove700,
  salesSummaryByBranchWise,
  collectionSummaryReport,
  branchAccount,
  acPartyAccount,
  statusWiseSummary,

  getTotalByBranchAndDate
};
