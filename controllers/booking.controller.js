import { User, Booking ,Delivery} from "../models/booking.model.js";
import CFMaster from "../models/cf.master.model.js";
import Company from "../models/company.model.js";
import ParcelLoading from "../models/pracel.loading.model.js";
import ParcelUnloading from "../models/parcel.unloading.model.js";
import Branch from "../models/branch.model.js";
import moment from "moment";
import mongoose from "mongoose";

const generateGrnNumber = async (companyId) => {
  const query = companyId ? { companyId } : {}; // Company-wise GRN
  const lastBooking = await Booking.findOne(query)
    .sort({ grnNo: -1 }) // Sort by grnNo for reliability
    .select("grnNo");

  const lastGrn = lastBooking?.grnNo;
  return typeof lastGrn === "number" ? lastGrn + 1 : 1000;
};

// Helper to extract 2-letter initialsss (smart fallback)
const extractInitials = (name) => {
  if (!name) return "XX";

  const trimmedName = name.trim();
  const words = trimmedName.split(/\s+/);

  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  const capitalLetters = trimmedName.match(/[A-Z]/g);
  if (capitalLetters?.length >= 2) {
    return (capitalLetters[0] + capitalLetters[1]).toUpperCase();
  }

  return trimmedName.substring(0, 2).toUpperCase();
};

// Helper to get current financial year range (Apr 1 – Mar 31)
const getFinancialYearRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 3 = Apr

  const startYear = month >= 3 ? year : year - 1;
  const endYear = startYear + 1;

  return {
    start: new Date(`${startYear}-04-01T00:00:00.000Z`),
    end: new Date(`${endYear}-03-31T23:59:59.999Z`)
  };
};

// Main LR generator
const generateLrNumber = async (fromCity, location, companyId, companyName) => {
  try {
    if (!companyId || !companyName) {
      throw new Error("Missing companyId or companyName in generateLrNumber");
    }

    // Extract smart initials
    const cityCode = extractInitials(fromCity);     // e.g., Hyderabad → HY
    const locationCode = extractInitials(location); // e.g., Ameerpet → AM
    const companyCode = extractInitials(companyName); // e.g., Sree Kaleswari → SK

    // console.log("Company Code:", companyCode);
    // console.log("City Code:", cityCode);
    // console.log("Location Code:", locationCode);

    const lrPrefix = `${companyCode}${cityCode}${locationCode}`;

    // Get current financial year range
    const { start, end } = getFinancialYearRange();

    // Find last LR in this pattern and FY
    const lastBooking = await Booking.findOne({
      companyId,
      lrNumber: { $regex: `^${lrPrefix}/\\d{4}/\\d{4}$` },
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: -1 });

    // Sequence logic
    let sequenceNumber = 1;
    if (lastBooking) {
      const lastSequence = parseInt(lastBooking.lrNumber.split("/")[1], 10);
      if (!isNaN(lastSequence)) {
        sequenceNumber = lastSequence + 1;
      }
    }

    const formattedSequence = String(sequenceNumber).padStart(4, "0");

    // GRN number fetch (you must already have this function defined)
    const grnNumber = await generateGrnNumber(companyId);
    const formattedGrn = String(grnNumber).padStart(4, "0");

    // Final LR Number
    const lrNumber = `${lrPrefix}/${formattedSequence}/${formattedGrn}`;
    return lrNumber;

  } catch (error) {
    console.error("LR Generation Error:", error.message);
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

const checkMembership = async (user) => {
  if (!user?.companyId) {
    // console.log("User does not have companyId");
    return false;
  }

  const company = await Company.findById(user.companyId).lean();
  if (!company) {
    // console.log("Company not found");
    return false;
  }

  const { startDate, validTill } = company.subscription || {};
  if (!startDate || !validTill) {
    console.log("Subscription dates missing");
    return false;
  }

  const now = new Date();
  return new Date(startDate) <= now && now <= new Date(validTill);
};

const createBooking = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    // --- Membership check ---
    const hasActiveMembership = await checkMembership(req.user);
    if (!hasActiveMembership) {
      return res.status(403).json({
        success: false,
        message: "Company membership expired or inactive. Booking not allowed.",
      });
    }

    // --- Booking limit check ---
    const company = await Company.findById(req.user.companyId);
    if (!company || !company.subscription?.validTill) {
      return res.status(403).json({
        message: "Subscription expired or not active. Booking not allowed.",
      });
    }

    const { startDate, validTill } = company.subscription;
    const limit = company.bookingLimit || 1000;

    // Normalize date range
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(validTill);
    end.setHours(23, 59, 59, 999);

    const currentBookingCount = await Booking.countDocuments({
      companyId: req.user.companyId,
      bookingDate: { $gte: start, $lte: end }
    });

    if (currentBookingCount >= limit) {
      return res.status(403).json({
        message: `Booking limit reached (${limit}). Please upgrade plan or wait.`,
      });
    }

    // --- Input sanitization ---
    const {
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      totalPrice,
      dispatchType,
      bookingType,
      agent,
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
       grandTotal === undefined || grandTotal === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required   fromCity  toCity  pickUpBranch   dropBranch,bookingType grandTotal fields",
      });
    }

    if (!senderName || !senderMobile || !receiverName || !receiverMobile) {
      return res.status(400).json({
        success: false,
        message: "Sender and receiver details are required",
      });
    }

    // ❌ Block if fromCity and toCity are the same (case-insensitive)
//    if (pickUpBranch.trim().toLowerCase() === dropBranch.trim().toLowerCase()) {
//   return res.status(400).json({
//     success: false,
//     message: "Pickup branch and Drop branch  be the same . Please select a different branch.",
//   });
// }

    if (bookingType === "credit" && (!agent || agent.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "Agent is required when booking type is 'credit'",
      });
    }

  // const bookingStatus = 0; // move this up here

  let deliveryAmount = 0;
    if (bookingType === "paid") {
     deliveryAmount = grandTotal;
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

    const companyId = req.user.companyId;
    const companyName = req.user.companyName;
    const location = req.user.branchName;
    const bookedBy = req.user.id;
    const bookingStatus = 0;
    const adminUniqueId = req.user.subadminUniqueId;

    const [grnNo, lrNumber, eWayBillNo, generatedReceiptNo] = await Promise.all([
      generateGrnNumber(companyId),
      generateLrNumber(fromCity, location, companyId, companyName),
      generateEWayBillNo(),
      generateReceiptNumber(),
    ]);

    const totalQuantity = packages.reduce(
      (sum, pkg) => sum + Number(pkg.quantity || 0),
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
      companyId,
      totalCharge,
      location,
      adminUniqueId,
      bookingTime: Date.now(),
      fromCity,
      toCity,
      agent,
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
       deliveryAmount,
    });

    const savedBooking = await booking.save();

    // Save users
    if (savedBooking) {
      try {
        // Save sender
        const senderExists = await User.findOne({
          phone: senderMobile,
          companyId,
        });

        if (!senderExists) {
          await User.create({
            name: senderName,
            phone: senderMobile,
            address: senderAddress,
            gst: senderGst,
            companyId,
          });
        }

        // Save receiver only if it's a different number
        if (receiverMobile !== senderMobile) {
          const receiverExists = await User.findOne({
            phone: receiverMobile,
            companyId,
          });

          if (!receiverExists) {
            await User.create({
              name: receiverName,
              phone: receiverMobile,
              address: receiverAddress,
              gst: receiverGst,
              companyId,
            });
          }
        }

      } catch (err) {
        console.error("User save error:", err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.log("Booking Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
};


const getAllBookings = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    console.log(req.user.companyShortCode,'khkhkjhk')
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized company access" });
    }

    const bookings = await Booking.find({ companyId });

    if (!bookings.length) {
      return res.status(404).json({ message: "No bookings found" });
    }

    return res.status(200).json({ success: true, data: bookings });
  } catch (err) {
    console.error("Error fetching bookings:", err.message);
    return res
      .status(500)
      .json({ message: "Server Error", error: err.message });
  }
};
const getAllBookingsPages = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized: User data missing" });
    }

    const { companyId, role, branchId, branchCity } = user;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    // 🕒 Set time range for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // 📌 Base filter
    let filter = {
      companyId,
      createdAt: { $gte: startOfDay, $lte: endOfDay }, // today only
    };

    // 🔍 Dynamic filter based on role
    if (role === "employee") {
      if (!branchId) {
        return res.status(400).json({ success: false, message: "Branch ID missing for employee" });
      }
      filter.pickUpBranch = branchId;
    } else if (role === "subadmin") {
      if (!branchCity) {
        return res.status(400).json({ success: false, message: "Branch city missing for subadmin" });
      }
      filter.fromCity = branchCity;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalBookings = await Booking.countDocuments(filter);
    const totalPages = Math.ceil(totalBookings / limit);

    const bookings = await Booking.find(filter)
      .populate("bookedBy")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;

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
    console.error("Error in getAllBookingsPages:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// const getAllBookingsPages = async (req, res) => {
//   try {
//     const user = req.user;

//     if (!user) {
//       return res.status(401).json({ success: false, message: "Unauthorized: User data missing" });
//     }

//     const { companyId, role, branchId, branchCity } = user;

//     if (!companyId) {
//       return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
//     }

//     // 🔍 Dynamic filter based on role
//     let filter = { companyId };

//     if (role === "employee") {
//       if (!branchId) {
//         return res.status(400).json({ success: false, message: "Branch ID missing for employee" });
//       }
//       filter.pickUpBranch = branchId;
//     } else if (role === "subadmin") {
//       if (!branchCity) {
//         return res.status(400).json({ success: false, message: "Branch city missing for subadmin" });
//       }
//       filter.fromCity = branchCity;
//     }
//     // Admin sees all bookings — no extra filtering

//     // 🔢 Pagination logic
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     // 📊 Count and query
//     const totalBookings = await Booking.countDocuments(filter);
//     const totalPages = Math.ceil(totalBookings / limit);

//     const bookings = await Booking.find(filter)
//       .populate("bookedBy")
//       .skip(skip)
//       .limit(limit)
//       .sort({ createdAt: -1 });

//     if (bookings.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No bookings found",
//         page,
//         limit,
//         totalPages,
//         totalBookings,
//         bookings: [],
//       });
//     }

//     // ⏭️ Pagination metadata
//     const nextPage = page < totalPages ? page + 1 : null;
//     const prevPage = page > 1 ? page - 1 : null;

//     res.status(200).json({
//       success: true,
//       page,
//       limit,
//       totalPages,
//       totalBookings,
//       nextPage,
//       prevPage,
//       bookings,
//     });
//   } catch (error) {
//     console.error("Error in getAllBookingsPages:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// };


const getBookingByGrnNo = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized company access" });
    }

    let { grnNo } = req.params;

    if (!grnNo) {
      return res
        .status(400)
        .json({ success: false, message: "GRN number is required" });
    }

    // Ensure grnNo is a number if stored as a number in DB
    grnNo = isNaN(grnNo) ? grnNo : Number(grnNo);

    const booking = await Booking.findOne({ grnNo, companyId }).populate(
      "bookedBy",
      "name"
    );

    if (!booking) {
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });
    }

    res.status(200).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingadminUniqueId = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }
    const { adminUniqueId } = req.params;
    const booking = await Booking.find({ adminUniqueId, companyId }).populate(
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
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }
    const { lrNumber } = req.body;

    const booking = await Booking.findOne({ lrNumber, companyId });

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
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }
    const { id } = req.params;

    const booking = await Booking.findOneAndDelete({ _id: id, companyId });

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
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    const { id } = req.params;
    const update = { ...req.body };

    // ❌ Prevent updates to immutable/sensitive fields
    delete update._id;
    delete update.grnNo;
    delete update.lrNumber;

    // 🔍 If pickUpBranch is updated, update pickUpBranchname too
    if (update.pickUpBranch) {
      const branch = await Branch.findOne({ branchUniqueId: update.pickUpBranch });
      if (!branch) {
        return res.status(404).json({ message: "Invalid pickUpBranch ID" });
      }
      update.pickUpBranchname = branch.name;
    }

    // 🔍 If dropBranch is updated, update dropBranchname too
    if (update.dropBranch) {
      const branch = await Branch.findOne({ branchUniqueId: update.dropBranch });
      if (!branch) {
        return res.status(404).json({ message: "Invalid dropBranch ID" });
      }
      update.dropBranchname = branch.name;
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: id, companyId },
      update,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!booking) {
      return res.status(404).json({ message: "Booking not found!" });
    }

    res.status(200).json({ message: "Successfully updated booking", booking });
  } catch (error) {
    console.error("Update Booking Error:", error.message);
    res.status(500).json({ error: error.message });
  }
};



const updateGRNBookings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }
    const { grnNo } = req.params;
    const update = req.body;

    const booking = await Booking.findOneAndUpdate({ grnNo, companyId }, update, {
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
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { grnNumbers, updateFields } = req.body;

    if (!grnNumbers || !Array.isArray(grnNumbers) || grnNumbers.length === 0) {
      return res.status(400).json({
        message: "Invalid or missing grnNumbers array",
      });
    }

    if (
      !updateFields ||
      typeof updateFields !== "object" ||
      Object.keys(updateFields).length === 0
    ) {
      return res.status(400).json({
        message: "Invalid or missing updateFields object",
      });
    }

    // Append updated timestamp
    updateFields.updatedAt = new Date();

    // Query filter including company scope
    const query = {
      grnNumber: { $in: grnNumbers },
      companyId,
    };

    const beforeUpdate = await Booking.find(query);

    const updateResult = await Booking.updateMany(query, {
      $set: updateFields,
    });

    const afterUpdate = await Booking.find(query);

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updateResult.modifiedCount} records`,
      beforeUpdate,
      afterUpdate,
    });
  } catch (error) {
    console.error("Error updating GRN numbers:", error);
    return res.status(500).json({
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

const getBookingsfromCityTotoCity = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromCity, toCity } = req.params;

    if (!fromCity || !toCity) {
      return res.status(400).json({
        success: false,
        message: "Required fields 'fromCity' and 'toCity' are missing!",
      });
    }

    const bookings = await Booking.find({
      fromCity,
      toCity,
      companyId,
    }).sort({ createdAt: -1 });

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for the given cities.",
      });
    }

    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


const getBookingsByAnyField = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }
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

    const bookings = await Booking.find({ $or: orConditions, companyId });

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

//by sudheer

// const toDayBookings = async (req, res) => {
//   try {
//     const { companyId, branchId } = req.user || {};

//     if (!req.user) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Unauthorized: User data missing" });
//     }

//     if (!companyId) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Unauthorized: Company ID missing" });
//     }

//     if (!branchId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Branch ID is missing in the token" });
//     }

//     const startOfDay = new Date();
//     startOfDay.setUTCHours(0, 0, 0, 0);

//     const endOfDay = new Date();
//     endOfDay.setUTCHours(23, 59, 59, 999);

//     const bookings = await Booking.find({
//       companyId,
//       pickUpBranch: branchId,
//       bookingDate: { $gte: startOfDay, $lte: endOfDay }, // fixed
//     });

//     if (bookings.length === 0) {
//       return res
//         .status(404)
//         .json({ success: false, message: "No bookings found for today" });
//     }

//     return res.status(200).json({ success: true, bookings });
//   } catch (error) {
//     console.error("Error in getBookingBydate:", error);
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };


const toDayBookings = async (req, res) => {
  try {
    const { companyId, branchId, role, branchCity } = req.user || {};


    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    let filter = {
      companyId,
      bookingDate: { $gte: startOfDay, $lte: endOfDay },
    };

    // 👷 Employee: filter by branch
    if (role === "employee") {
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: "Branch ID missing for employee",
        });
      }
      filter.pickUpBranch = branchId;
      console.log(branchId)
    }

    // 👨‍💼 Subadmin: filter by city (fromCity === branchCity)
    else if (role === "subadmin") {
      if (!branchCity) {
        return res.status(400).json({
          success: false,
          message: "Branch city is missing for subadmin",
        });
      }
      filter.fromCity = branchCity;
    }

    // 👑 Admin: sees all bookings (no extra filter)

    const bookings = await Booking.find(filter);

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for today",
      });
    }

    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("Error in toDayBookings:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const getUsersBySearch = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const query = req.query?.query?.trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required!",
      });
    }

    const searchRegex = new RegExp(query, "i");

    // Step 1: Search Users belonging to the same company
    const users = await User.find(
      {
        companyId, // Ensure company restriction
        $or: [
          { name: searchRegex },
          { phone: searchRegex },
          { address: searchRegex },
          { gst: searchRegex },
        ],
      }
    ).limit(20); // Optional limit

    if (users.length > 0) {
      const responseData = users.map((user) => ({
        type: "user",
        name: user.name,
        phone: user.phone,
        address: user.address,
        gst: user.gst,
      }));

      return res.status(200).json({
        success: true,
        source: "User",
        count: responseData.length,
        results: responseData,
      });
    }

    // Step 2: If no users found, search in CFMaster (also filter by companyId if applicable)
    const companies = await CFMaster.find({
      companyId, // Remove this line if CFMaster is global and not company-specific
      $or: [
        { name: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
        { gst: searchRegex },
      ],
    }).limit(20);

    if (companies.length > 0) {
      const responseData = companies.map((company) => ({
        type: "company",
        name: company.name,
        phone: company.phone,
        address: company.address,
        gst: company.gst,
      }));

      return res.status(200).json({
        success: true,
        source: "CFMaster",
        count: responseData.length,
        results: responseData,
      });
    }

    return res.status(404).json({
      success: false,
      message: "No matching users or companies found!",
    });
  } catch (error) {
    console.error("Search error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong: " + error.message,
    });
  }
};


const getAllUsers = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }
    const users = await User.find({ companyId });
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

const deleteUserByPhone = async (req, res) => {
  try {
    const { phone } = req.params;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    const deletedUser = await User.findOneAndDelete({ phone });

    if (!deletedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found with this phone number",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: deletedUser,
    });
  } catch (error) {
    console.error("Error deleting user:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


const getUserByMobile = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { senderMobile } = req.params;

    if (!senderMobile) {
      return res.status(400).json({
        success: false,
        message: "Sender mobile number is required",
      });
    }

    const users = await Booking.find({ senderMobile, companyId });

    if (!users || users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for this mobile number",
      });
    }

    res.status(200).json({
      success: true,
      count: users.length,
      bookings: users,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


const getCreditBookings = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const creditBookings = await Booking.find({
      bookingType: "credit",
      companyId,
    })
      .select("senderName senderMobile senderGst grandTotal bookingDate")
      .sort({ bookingDate: -1 }); // newest first

    if (!creditBookings.length) {
      return res.status(404).json({
        success: false,
        message: "No credit bookings found for this company",
      });
    }

    res.status(200).json({
      success: true,
      count: creditBookings.length,
      data: creditBookings,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const receivedBooking = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { grnNo, receiverName, receiverMobile, toPayDeliveredAmount } = req.body;
    const deliveryEmployee = req.user?.name;
    const deliveryBranchName = req.user?.branchName || null;
    const deliveryBranchId = req.user?.branchUniqueId;

    // ✅ Input Validations
    if (!grnNo) {
      return res.status(400).json({ message: "grnNo is required!" });
    }
    if (!deliveryEmployee) {
      return res.status(400).json({ message: "Delivery employee name is required!" });
    }
    if (!receiverName || !receiverMobile) {
      return res.status(400).json({ message: "Receiver name and mobile number are required!" });
    }
   
    if (toPayDeliveredAmount === undefined || toPayDeliveredAmount === null) {
  return res.status(400).json({ message: "toPayDeliveredAmount is required!" });
}


    const booking = await Booking.findOne({ grnNo, companyId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found!" });
    }

    if (booking.bookingStatus === 4) {
      return res.status(400).json({ message: "Parcel already received!" });
    }
    if (booking.bookingStatus !== 2) {
      return res.status(400).json({
        message: "Your parcel is not eligible for receiving (unloading not completed).",
      });
    }

    if (booking.unloadingBranchname !== deliveryBranchName) {
      return res.status(403).json({
        message: "You cannot receive this parcel. It was unloaded at a different branch.",
        unloadingBranch: booking.unloadingBranchname,
        yourBranch: deliveryBranchName,
      });
    }

    const deliveryDate = new Date();

    // ✅ Save Delivery record
    const newDelivery = new Delivery({
      companyId,
      grnNo,
      receiverName,
      receiverMobile,
      deliveryDate,
      toPayDeliveredAmount,
      deliveryEmployee,
      deliveryBranchName,
    });
    await newDelivery.save();

    // ✅ Update Booking
    booking.bookingStatus = 4;
    booking.deliveryDate = deliveryDate;
    booking.toPayDeliveredAmount = toPayDeliveredAmount;
    booking.deliveryEmployee = deliveryEmployee;
    booking.deliveryBranchName = deliveryBranchName;
    booking.receiverName = receiverName;
    booking.receiverMobile = receiverMobile;

    if (booking.bookingType === "toPay") {
      booking.toPayCollectedBranch = deliveryBranchId;
      booking.toPayDeliveredAmount = booking.grandTotal; // or toPayDeliveredAmount if needed
    }

    await booking.save({ validateModifiedOnly: true });

    return res.status(200).json({
      success: true,
      message: "Booking received successfully",
      booking,
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};


const getAllDeliveries = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const deliveries = await Delivery.find({ companyId });
    return res.status(200).json({
      success: true,
      count: deliveries.length,
      data: deliveries,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};


const updateDelivery = async (req, res) => {
  try {
    const { id } = req.params; // from route like /delivery/:deliveryId
    const updateFields = req.body;     // contains fields to update

    if (!id) {
      return res.status(400).json({ message: "Delivery ID is required" });
    }

    const updatedDelivery = await Delivery.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true } // return updated document
    );

    if (!updatedDelivery) {
      return res.status(404).json({ message: "Delivery not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery updated successfully",
      data: updatedDelivery,
    });
  } catch (error) {
    console.error("Error updating delivery:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const cancelBooking = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { grnNo } = req.params;
    const {
      refundAmount,
      cancelDate,
      cancelByUser,
      cancelBranch,
      cancelCity,
    } = req.body;

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const booking = await Booking.findOne({ grnNo, companyId });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.bookingStatus === 4) {
      return res.status(400).json({
        message: "Booking cannot be cancelled. Parcel already received.",
      });
    }

    // if (booking.bookingStatus === 5) {
    //   return res.status(400).json({
    //     message: "Booking is already cancelled.",
    //   });
    // }

    // Proceed to cancel the booking
    // booking.bookingStatus = 5;
    booking.cancelByUser = cancelByUser || req.user.name || "Unknown";
    booking.cancelBranch = cancelBranch || req.user.branch || null;
    booking.cancelCity = cancelCity || req.user.city || null;
    booking.cancelDate = cancelDate && !isNaN(new Date(cancelDate))
      ? new Date(cancelDate)
      : new Date();

    // If you want to delete the refundCharge field from DB:
    booking.set("refundCharge", undefined, { strict: false }); // Or delete booking.refundCharge;

    if (refundAmount !== undefined) {
      booking.refundAmount = refundAmount;
    }

    await booking.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: "Booking cancelled successfully",
      booking,
    });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


const parcelBookingReports = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

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

    const fromDateTime = new Date(`${fromDate}T00:00:00.000Z`);
    const toDateTime = new Date(`${toDate}T23:59:59.999Z`);

    let query = {
      bookingDate: { $gte: fromDateTime, $lte: toDateTime },
      companyId,
    };

    if (userRole === "employee") {
      query.pickUpBranch = userBranchId;
    } else if (req.body.branch) {
      query.pickUpBranch = req.body.branch;
    }

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;

    if (bookingStatus !== undefined && bookingStatus !== null && bookingStatus !== '') {
      query.bookingStatus = Number(bookingStatus);
    }

    const bookingTypes = bookingType
      ? Array.isArray(bookingType) ? bookingType : [bookingType]
      : ["paid", "credit", "toPay", "FOC", "CLR"];

    const result = {};
    let totalBookingsCount = 0; // <-- for checking if any data was found

    await Promise.all(
      bookingTypes.map(async (type) => {
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

        const allGrandTotal = bookings.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
        const allTotalQuantity = bookings.reduce((sum, b) => sum + (b.totalQuantity || 0), 0);

        result[type] = {
          bookings,
          allGrandTotal,
          allTotalQuantity,
        };

        totalBookingsCount += bookings.length;
      })
    );

    if (totalBookingsCount === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for the given criteria.",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in parcelBookingReports:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};


// const parcelBookingReports = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
//     }

//     let { fromDate, toDate, fromCity, toCity, bookingStatus, bookingType } = req.body;

//     if (!fromDate || !toDate) {
//       return res.status(400).json({
//         success: false,
//         message: "Both fromDate and toDate are required.",
//       });
//     }

//     const userRole = req.user.role;
//     const userBranchId = req.user.branchId;
//     const fromDateTime = new Date(`${fromDate}T00:00:00.000Z`);
//     const toDateTime = new Date(`${toDate}T23:59:59.999Z`);

//     const bookingTypes = bookingType
//       ? Array.isArray(bookingType) ? bookingType : [bookingType]
//       : ["paid", "credit", "toPay", "FOC", "CLR"];

//     let result = {};
//     const commonFilter = { companyId };

//     if (userRole === "employee") {
//       commonFilter.pickUpBranch = userBranchId;
//     } else if (req.body.branch) {
//       commonFilter.pickUpBranch = req.body.branch;
//     }

//     if (fromCity) commonFilter.fromCity = fromCity;
//     if (toCity) commonFilter.toCity = toCity;

//     const handleBookingQuery = async (extraFilter = {}, dateField = "bookingDate") => {
//       return await Booking.find({
//         ...commonFilter,
//         [dateField]: { $gte: fromDateTime, $lte: toDateTime },
//         ...extraFilter,
//         bookingType: { $in: bookingTypes },
//       })
//         .sort({ [dateField]: -1 })
//         .select(
//           "grnNo bookingStatus bookedBy bookingDate pickUpBranchname dropBranchname senderName receiverName packages.weight packages.actulWeight totalQuantity grandTotal hamaliCharge valueOfGoods eWayBillNo bookingType"
//         )
//         .populate({
//           path: "bookedBy",
//           select: "name",
//         });
//     };

//     const getBookingFromModel = async (Model, dateField) => {
//       const modelDocs = await Model.find({
//         ...commonFilter,
//         [dateField]: { $gte: fromDateTime, $lte: toDateTime },
//       }).lean();

//       // Ensure grnNos are cast to Number
//       const grnNos = modelDocs
//         .map(doc => Number(doc.grnNo))
//         .filter(n => !isNaN(n));

//       if (!grnNos.length) return [];
//       return await handleBookingQuery({ grnNo: { $in: grnNos } });
//     };

//     let bookings = [];

//     switch (Number(bookingStatus)) {
//       case 0: // Booked
//         bookings = await handleBookingQuery({ bookingStatus: 0 });
//         break;

//       case 1: // Loading
//         bookings = await getBookingFromModel(ParcelLoading, "loadingDate");
//         break;

//       case 2: // Unloading
//         bookings = await getBookingFromModel(ParcelUnloading, "unloadingDate");
//         break;

//       case 3: // Missing
//         bookings = await handleBookingQuery({ missingDate: { $ne: null } });
//         break;

//       case 4: { // Delivered
//         const deliveries = await Delivery.find({
//           companyId,
//           deliveryDate: { $gte: fromDateTime, $lte: toDateTime },
//         }).lean();

//         const grnNos = deliveries
//           .map(d => Number(d.grnNo))
//           .filter(n => !isNaN(n));

//         bookings = grnNos.length
//           ? await handleBookingQuery({ grnNo: { $in: grnNos } })
//           : [];
//         break;
//       }

//       case 5: // Cancelled
//         bookings = await handleBookingQuery({ cancelDate: { $ne: null } }, "cancelDate");
//         break;

//       default:
//         return res.status(400).json({
//           success: false,
//           message: "Invalid bookingStatus provided",
//         });
//     }

//     if (!bookings || bookings.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "No bookings found for the given criteria.",
//       });
//     }

//     // Group by bookingType
//     const grouped = {};
//     bookingTypes.forEach((type) => {
//       grouped[type] = {
//         bookings: [],
//         allGrandTotal: 0,
//         allTotalQuantity: 0,
//       };
//     });

//     bookings.forEach((b) => {
//       const type = b.bookingType;
//       if (!grouped[type]) return;
//       grouped[type].bookings.push(b);
//       grouped[type].allGrandTotal += b.grandTotal || 0;
//       grouped[type].allTotalQuantity += b.totalQuantity || 0;
//     });

//     result = grouped;

//     return res.status(200).json({
//       success: true,
//       data: result,
//     });

//   } catch (error) {
//     console.error("Error in parcelBookingReports:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error fetching bookings",
//       error: error.message,
//     });
//   }
// };


const allParcelBookingReport = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing.",
      });
    }

    const companyId = req.user?.companyId;
    
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing.",
      });
    }

    const {
      startDate,
      endDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      bookingStatus,
      vehicalNumber, // keep spelling consistent with your DB
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

    const query = {
      companyId,
      bookingDate: {
        $gte: new Date(`${startDate}T00:00:00.000Z`),
        $lte: new Date(`${endDate}T23:59:59.999Z`),
      },
    };

    // Optional filters
    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, "i") };
    if (pickUpBranch) query.pickUpBranch = { $regex: new RegExp(pickUpBranch, "i") };
    if (dropBranch) query.dropBranch = { $regex: new RegExp(dropBranch, "i") };
      if (vehicalNumber) query.vehicalNumber = { $regex: new RegExp(vehicalNumber, "i") };

   if (
  bookingStatus !== undefined &&
  bookingStatus !== null &&
  bookingStatus !== ''
) {
  query.bookingStatus = Number(bookingStatus);
}

  
    const bookings = await Booking.find(query).select(
      "grnNo bookingDate bookingStatus fromCity toCity bookingType pickUpBranchname dropBranchname senderName receiverName totalQuantity grandTotal hamaliCharges vehicalNumber"
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found matching the criteria.",
      });
    }

    // Grouping bookings by vehicle number
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
      vehicleGrouped[vNo].totalHamaliCharge += Number(booking.hamaliCharges || 0);
    });

    const groupedResult = Object.values(vehicleGrouped);

    res.status(200).json({
      success: true,
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
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    const { fromDate, toDate, fromCity, toCity } = req.body;

    let query = { companyId };

    if (req.user.role === "employee") {
      query.pickUpBranch = req.user.branchId;
    }

    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, "i") };

    const bookingTypes = ["paid", "credit", "toPay", "FOC", "CLR"];

    const result = {};
    let finalGrandTotal = 0;
    let finalTotalPackages = 0;
    let finalTotalQuantity = 0;
    let hasAnyBooking = false;

    for (const type of bookingTypes) {
      const typeQuery = { ...query, bookingType: type };

      const bookings = await Booking.find(typeQuery)
        .sort({ bookingDate: 1 })
        .select(
          "grnNo bookingStatus bookedBy bookingDate pickUpBranchname dropBranchname totalPackages senderName receiverName packages totalQuantity grandTotal"
        );

      if (bookings.length > 0) hasAnyBooking = true;

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

    if (!hasAnyBooking) {
      return res.status(404).json({
        success: false,
        message: "No bookings found for the given filters.",
      });
    }

    return res.status(200).json({
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
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};

const parcelCancelReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, toCity, bookingType } = req.body;

    // Build base query
    const query = {
      companyId,
      bookingStatus: 5, // Cancelled
    };

    // Apply cancelDate filter
    let start, end;
    if (fromDate && toDate) {
      start = new Date(fromDate);
      end = new Date(toDate);
    } else {
      // Default: last 30 days
      end = new Date();
      start = new Date();
      start.setDate(end.getDate() - 30);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format.",
      });
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    query.cancelDate = { $gte: start, $lte: end };

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

    // Debug query
    console.log("Cancel Report Query:", query);

    // Fetch bookings
    const bookings = await Booking.find(query)
      .select(
        "bookingDate cancelDate fromCity toCity grnNo senderName receiverName totalQuantity grandTotal refundCharge refundAmount cancelByUser"
      )
      .sort({ bookingDate: 1 })
      .lean();

    if (!bookings.length) {
      return res.status(200).json({
        success: true,
        message: "No cancelled bookings found for the given criteria.",
        data: [],
        count: 0,
        allTotalQuantity: 0,
        allGrandTotal: 0,
      });
    }

    // Aggregate totals
    let allTotalQuantity = 0;
    let allGrandTotal = 0;

    const formattedData = bookings.map((b) => {
      allTotalQuantity += b.totalQuantity || 0;
      allGrandTotal += b.grandTotal || 0;
      return {
        bookingDate: b.bookingDate,
        cancelDate: b.cancelDate,
        fromCity: b.fromCity,
        toCity: b.toCity,
        grnNo: b.grnNo,
        senderName: b.senderName,
        receiverName: b.receiverName,
        totalQuantity: b.totalQuantity || 0,
        grandTotal: b.grandTotal || 0,
        cancelCharge: b.refundCharge || 0,
        refundAmount: b.refundAmount || 0,
        cancelBy: b.cancelByUser || "",
      };
    });

    return res.status(200).json({
      success: true,
      message: "Cancelled bookings fetched successfully.",
      data: formattedData,
      count: bookings.length,
      allTotalQuantity,
      allGrandTotal,
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
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const {
      fromDate,
      toDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
    } = req.body;

    let query = { companyId };

    // Date range filter
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // City filters
    if (fromCity) query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };

    // Optional branch filters
    if (pickUpBranch)
      query.pickUpBranch = { $regex: new RegExp(`^${pickUpBranch}$`, "i") };

    if (dropBranch)
      query.dropBranch = { $regex: new RegExp(`^${dropBranch}$`, "i") };

    const bookings = await Booking.find(query).select(
      "bookingDate grnNo fromCity toCity hamaliCharges totalBookings pickUpBranch pickUpBranchname dropBranch totalPackages totalQuantity grandTotal"
    );

    if (bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No customer bookings found.",
        data: [],
      });
    }

    // Summarize
    const totalBookings = bookings.length;
    let totalPackages = 0;
    let totalQuantity = 0;
    let totalAmount = 0;
    let totalHamaliCharges = 0;

    bookings.forEach((b) => {
      totalPackages += b.totalPackages || 0;
      totalQuantity += b.totalQuantity || 0;
      totalAmount += b.grandTotal || 0;
      totalHamaliCharges += b.hamaliCharges || 0;
    });

    res.status(200).json({
      success: true,
      message: "Parcel booking summary report generated.",
      summary: {
        totalBookings,
        totalPackages,
        totalQuantity,
        totalAmount,
        totalHamaliCharges,
      },
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching parcel booking summary report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// const parcelBookingSummaryReport = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized: Company ID missing",
//       });
//     }

//     const {
//       fromDate,
//       toDate,
//       fromCity,
//       toCity,
//       pickUpBranch,
//       dropBranch,
//     } = req.body;

//     const userRole = req.user?.role;
//     const userBranchId = req.user?.branchId;

//     let query = { companyId }; // Include company filter

//     // Date range
//     if (fromDate && toDate) {
//       query.bookingDate = {
//         $gte: new Date(fromDate + "T00:00:00.000Z"),
//         $lte: new Date(toDate + "T23:59:59.999Z"),
//       };
//     }

//     // City filters (exact match, case-insensitive)
//     if (fromCity) query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
//     if (toCity) query.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };

//     // Branch filters
//     // if (userRole === "employee") {
//     //   query.pickUpBranch = userBranchId;
//     // } else {
//     //   if (pickUpBranch)
//     //     query.pickUpBranch = { $regex: new RegExp(`^${pickUpBranch}$`, "i") };
//     // }

//     if (dropBranch)
//       query.dropBranch = { $regex: new RegExp(`^${dropBranch}$`, "i") };

//     const bookings = await Booking.find(query).select(
//       "bookingDate grnNo fromCity toCity hamaliCharges totalBookings pickUpBranch pickUpBranchname dropBranch totalPackages totalQuantity grandTotal"
//     );

//     if (bookings.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: "No customer bookings found.",
//         data: [],
//       });
//     }

//     // Summarize
//     let totalBookings = bookings.length;
//     let totalPackages = 0;
//     let totalQuantity = 0;
//     let totalAmount = 0;

//     bookings.forEach((b) => {
//       totalPackages += b.totalPackages || 0;
//       totalQuantity += b.totalQuantity || 0;
//       totalAmount += b.grandTotal || 0;
//     });

//     res.status(200).json({
//       success: true,
//       message: "Parcel booking summary report generated.",
//       summary: {
//         totalBookings,
//         totalPackages,
//         totalQuantity,
//         totalAmount,
//       },
//       data: bookings,
//     });
//   } catch (error) {
//     console.error("Error fetching parcel booking summary report:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

// const parcelBookingMobileNumber = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Unauthorized: Company ID missing" });
//     }

//     const {
//       fromDate,
//       toDate,
//       mobile,
//       bookingType,
//       bookingStatus,
//       reportType,
//     } = req.body;

//     if (!req.user) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized: User data missing",
//       });
//     }

//     const query = [{ companyId }];

//     // Restrict employee to their branch
//     if (req.user.role === "employee") {
//       query.push({ pickUpBranch: req.user.branchId });
//     }

//     // Date range
//     if (fromDate && toDate) {
//       query.push({
//         bookingDate: {
//           $gte: new Date(`${fromDate}T00:00:00.000Z`),
//           $lte: new Date(`${toDate}T23:59:59.999Z`),
//         },
//       });
//     }

//     // Normalize and filter by mobile based on reportType
//     const normalizedType = reportType?.trim().toLowerCase();
//     if (mobile && normalizedType) {
//       if (normalizedType === "sender") {
//         query.push({ senderMobile: mobile });
//       } else if (normalizedType === "receiver") {
//         query.push({ receiverMobile: mobile });
//       } else if (normalizedType === "all") {
//         query.push({
//           $or: [{ senderMobile: mobile }, { receiverMobile: mobile }],
//         });
//       }
//     }

//     // Optional filters
//     if (bookingType) query.push({ bookingType });
//     if (bookingStatus !== undefined) query.push({ bookingStatus });

//     const finalQuery = query.length ? { $and: query } : {};

//     const bookings = await Booking.find(finalQuery)
//       .sort({ bookingDate: 1 })
//       .select(
//         "grnNo lrNumber bookingDate pickUpBranchname fromCity toCity senderName senderMobile receiverName receiverMobile deliveryDate bookingType totalQuantity grandTotal"
//       );

//     if (!bookings.length) {
//       return res.status(200).json({
//         success: true,
//         message: "No customer bookings found.",
//         data: [],
//         count: 0,
//         allGrandTotal: 0,
//         allTotalQuantity: 0,
//       });
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
//       message: "Bookings filtered by mobile fetched successfully.",
//       data: bookings,
//       count: bookings.length,
//       allGrandTotal,
//       allTotalQuantity,
//     });
//   } catch (error) {
//     console.error("Error fetching parcel booking by mobile:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };


const parcelBookingMobileNumber = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    const {
      fromDate,
      toDate,
      mobile,
      bookingType,
      bookingStatus,
      reportType,
      fromCity,
      pickUpBranch,
    } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    const query = [{ companyId }];

    // Date range
    if (fromDate && toDate) {
      query.push({
        bookingDate: {
          $gte: new Date(`${fromDate}T00:00:00.000Z`),
          $lte: new Date(`${toDate}T23:59:59.999Z`),
        },
      });
    }

    // Optional filters
    if (fromCity) {
      query.push({ fromCity: { $regex: new RegExp(fromCity, "i") } });
    }

    if (pickUpBranch) {
      query.push({ pickUpBranch: { $regex: new RegExp(pickUpBranch, "i") } });
    }

    if (bookingType) {
      query.push({ bookingType });
    }

    if (
      bookingStatus !== undefined &&
      bookingStatus !== null &&
      bookingStatus !== ""
    ) {
      query.push({ bookingStatus: Number(bookingStatus) });
    }

    // Mobile filtering based on reportType
    const normalizedType = reportType?.trim().toLowerCase();
    if (mobile && normalizedType) {
      if (normalizedType === "sender") {
        query.push({ senderMobile: mobile });
      } else if (normalizedType === "receiver") {
        query.push({ receiverMobile: mobile });
      } else if (normalizedType === "all") {
        query.push({
          $or: [{ senderMobile: mobile }, { receiverMobile: mobile }],
        });
      }
    }

    const finalQuery = query.length ? { $and: query } : {};

    const bookings = await Booking.find(finalQuery)
      .sort({ bookingDate: 1 })
      .select(
        "grnNo lrNumber bookingDate pickUpBranchname fromCity toCity senderName senderMobile receiverName receiverMobile deliveryDate bookingType totalQuantity grandTotal"
      );

    if (!bookings.length) {
      return res.status(200).json({
        success: true,
        message: "No customer bookings found.",
        data: [],
        count: 0,
        allGrandTotal: 0,
        allTotalQuantity: 0,
      });
    }

    const allGrandTotal = bookings.reduce(
      (sum, b) => sum + (b.grandTotal || 0),
      0
    );
    const allTotalQuantity = bookings.reduce(
      (sum, b) => sum + (b.totalQuantity || 0),
      0
    );

    res.status(200).json({
      success: true,
      message: "Bookings filtered by mobile fetched successfully.",
      data: bookings,
      count: bookings.length,
      allGrandTotal,
      allTotalQuantity,
    });
  } catch (error) {
    console.error("Error fetching parcel booking by mobile:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const regularCustomerBooking = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    const {
      fromDate,
      toDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      name,
    } = req.body;

    const query = {
      companyId, // Ensure data isolation
    };

    // Date filter
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // City and branch filters
    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    // Name filter
    if (name) {
      query.$or = [
        { senderName: { $regex: new RegExp(name, "i") } },
        { receiverName: { $regex: new RegExp(name, "i") } },
      ];
    }

    const bookings = await Booking.find(query)
      .sort({ bookingDate: 1 })
      .select(
        "fromCity pickUpBranchname toCity dropBranchname bookingDate senderName receiverName senderMobile grandTotal totalQuantity"
      );

    if (!bookings.length) {
      return res.status(200).json({
        success: true,
        message: "No customer bookings found.",
        data: [],
        count: 0,
        allGrandTotal: 0,
        allTotalQuantity: 0,
      });
    }

    const allGrandTotal = bookings.reduce(
      (sum, b) => sum + (b.grandTotal || 0),
      0
    );
    const allTotalQuantity = bookings.reduce(
      (sum, b) => sum + (b.totalQuantity || 0),
      0
    );

    res.status(200).json({
      success: true,
      message: "Regular customer bookings fetched successfully.",
      data: bookings,
      count: bookings.length,
      allGrandTotal,
      allTotalQuantity
    });
  } catch (error) {
    console.error("Error in regularCustomerBooking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const branchWiseCollectionReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const filter = {
      bookingDate: { $gte: start, $lte: end },
     companyId: new mongoose.Types.ObjectId(companyId)
    };
    if (fromCity) filter.fromCity = fromCity;
    if (pickUpBranch) filter.pickUpBranch = pickUpBranch;
    if (bookedBy) filter.bookedBy = bookedBy;

    const reportData = await Booking.aggregate([
      { $match: filter },
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
      {
        $group: {
          _id: {
            branchName: "$pickUpBranchname",
            bookingType: "$bookingType"
          },
          bookingCount: { $sum: 1 },
          normalGrand: { $sum: "$normalGrand" },
          cancelGrand: { $sum: "$cancelGrand" },
          totalQty: { $sum: "$totalQuantity" }
        }
      },
      {
        $group: {
          _id: "$_id.branchName",
          byType: {
            $push: {
              bookingType: "$_id.bookingType",
              bookingCount: "$bookingCount",
              grandTotal: "$normalGrand",
              cancelAmount: "$cancelGrand",
              totalQuantity: "$totalQty"
            }  
          },   
          branchGrandTotal: { $sum: "$normalGrand" },  
          branchCancelAmount: { $sum: "$cancelGrand" },
          branchTotalQty: { $sum: "$totalQty" }
        }
      },
      {
        $project: {
          _id: 0,
          branchName: "$_id",
          bookingTypes: "$byType",
          branchGrandTotal: 1,
          branchCancelAmount: 1,
          branchTotalQty: 1
        }
      },
      { $sort: { branchName: 1 } }
    ]);

    if (!reportData.length) {
      return res.status(404).json({ message: "No bookings found." });
    }

    const totals = reportData.reduce(
      (acc, b) => {
        acc.finalGrandTotal += b.branchGrandTotal;
        acc.finalCancelAmount += b.branchCancelAmount;
        acc.finalTotalQty += b.branchTotalQty;
        return acc;
      },
      { finalGrandTotal: 0, finalCancelAmount: 0, finalTotalQty: 0 }
    );

    res.status(200).json({
      branches: reportData,
      totals
    });

  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ error: err.message });
  }
};

//.....................................................................................


//for summary for details report working

const collectionforSummaryReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const filter = {
      bookingDate: { $gte: start, $lte: end },
      companyId: new mongoose.Types.ObjectId(companyId),
    };
    if (fromCity) filter.fromCity = fromCity;
    if (pickUpBranch) filter.pickUpBranch = pickUpBranch;
    if (bookedBy) filter.bookedBy = bookedBy;

    const reportData = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$pickUpBranchname",
          totalAmount: {
            $sum: { $add: [
              { $cond: [{ $ne: ["$bookingStatus", 5] }, "$grandTotal", 0] },
              { $cond: [{ $eq: ["$bookingStatus", 5] }, "$grandTotal", 0] }
            ]}
          },
          cancelAmount: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 5] }, "$grandTotal", 0] }
          },
          totalQuantity: {
            $sum: { $add: [
              { $cond: [{ $ne: ["$bookingStatus", 5] }, "$totalQuantity", 0] },
              { $cond: [{ $eq: ["$bookingStatus", 5] }, "$totalQuantity", 0] }
            ]}
          },
          cancelQuantity: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 5] }, "$totalQuantity", 0] }
          },
          netAmount: {
            $sum: { $cond: [{ $ne: ["$bookingStatus", 5] }, "$grandTotal", 0] }
          },
          netQuantity: {
            $sum: { $cond: [{ $ne: ["$bookingStatus", 5] }, "$totalQuantity", 0] }
          }
        }
      },
      {
        $project: {
          _id: 0,
          branchName: "$_id",
          totalAmount: 1,
          totalQuantity: 1,
          cancelAmount: 1,
          cancelQuantity: 1,
          netAmount: 1,
          netQuantity: 1,
          netTotal: "$netAmount"
        }
      },
      { $sort: { branchName: 1 } }
    ]);

    if (!reportData.length) {
      return res.status(404).json({ message: "No bookings found." });
    }

    // Calculate final summary
    const summary = reportData.reduce((acc, curr) => {
      acc.finalTotalAmount += curr.totalAmount;
      acc.finalTotalQuantity += curr.totalQuantity;
      acc.finalCancelAmount += curr.cancelAmount;
      acc.finalCancelQuantity += curr.cancelQuantity;
      acc.finalNetTotal += curr.netTotal;
      return acc;
    }, {
      finalTotalAmount: 0,
      finalTotalQuantity: 0,
      finalCancelAmount: 0,
      finalCancelQuantity: 0,
      finalNetTotal: 0
    });

    // Final Response
    res.status(200).json({
      branches: reportData,
      ...summary
    });

  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ error: err.message });
  }
};

const collectionReportToPay = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    // Build base filter
    const filter = {
      bookingDate: { $gte: start, $lte: end },
      bookingType: "toPay", // Only include toPay type bookings
      companyId: new mongoose.Types.ObjectId(companyId),
    };
    if (fromCity) filter.fromCity = fromCity;
    if (pickUpBranch) filter.pickUpBranch = pickUpBranch;
    if (bookedBy) filter.bookedBy = bookedBy;

    const reportData = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$pickUpBranchname",
          totalAmount: {
            $sum: {
              $add: [
                { $cond: [{ $ne: ["$bookingStatus", 5] }, "$grandTotal", 0] },
                { $cond: [{ $eq: ["$bookingStatus", 5] }, "$grandTotal", 0] }
              ]
            }
          },
          cancelAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 5] }, "$grandTotal", 0]
            }
          },
          totalQuantity: {
            $sum: {
              $add: [
                { $cond: [{ $ne: ["$bookingStatus", 5] }, "$totalQuantity", 0] },
                { $cond: [{ $eq: ["$bookingStatus", 5] }, "$totalQuantity", 0] }
              ]
            }
          },
          cancelQuantity: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 5] }, "$totalQuantity", 0]
            }
          },
          netAmount: {
            $sum: {
              $cond: [{ $ne: ["$bookingStatus", 5] }, "$grandTotal", 0]
            }
          },
          netQuantity: {
            $sum: {
              $cond: [{ $ne: ["$bookingStatus", 5] }, "$totalQuantity", 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          branchName: "$_id",
          totalAmount: 1,
          totalQuantity: 1,
          cancelAmount: 1,
          cancelQuantity: 1,
          netAmount: 1,
          netQuantity: 1,
          netTotal: "$netAmount"
        }
      },
      { $sort: { branchName: 1 } }
    ]);

    if (!reportData.length) {
      return res.status(404).json({ message: "No bookings found." });
    }

    // Final Summary Calculation
    const summary = reportData.reduce((acc, curr) => {
      acc.finalTotalAmount += curr.totalAmount;
      acc.finalTotalQuantity += curr.totalQuantity;
      acc.finalCancelAmount += curr.cancelAmount;
      acc.finalCancelQuantity += curr.cancelQuantity;
      acc.finalNetTotal += curr.netTotal;
      return acc;
    }, {
      finalTotalAmount: 0,
      finalTotalQuantity: 0,
      finalCancelAmount: 0,
      finalCancelQuantity: 0,
      finalNetTotal: 0
    });

    res.status(200).json({
      branches: reportData,
      ...summary
    });

  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ error: err.message });
  }
};


// const allCollectionReport = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
//     }

//     const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

//     if (!fromDate || !toDate) {
//       return res.status(400).json({ error: "fromDate and toDate are required" });
//     }

//     const start = new Date(fromDate);
//     const end = new Date(toDate);
//     end.setHours(23, 59, 59, 999);

//     if (isNaN(start) || isNaN(end)) {
//       return res.status(400).json({ error: "Invalid date format" });
//     }

//     const filter = {
//       bookingDate: { $gte: start, $lte: end },
//       companyId: new mongoose.Types.ObjectId(companyId),
//     };
//     if (fromCity) filter.fromCity = fromCity;
//     if (pickUpBranch) filter.pickUpBranch = pickUpBranch;
//     if (bookedBy) filter.bookedBy = new mongoose.Types.ObjectId(bookedBy);

//     // Step 1: Aggregate Booking Data
//     const bookingData = await Booking.aggregate([
//       { $match: filter },
//       {
//         $group: {
//           _id: "$pickUpBranchname",
//           paidAmount: {
//             $sum: {
//               $cond: [
//                 { $and: [{ $eq: ["$bookingType", "paid"] }, { $ne: ["$bookingStatus", 5] }] },
//                 "$grandTotal",
//                 0,
//               ],
//             },
//           },
//           toPayAmount: {
//             $sum: {
//               $cond: [
//                 { $and: [{ $eq: ["$bookingType", "toPay"] }, { $ne: ["$bookingStatus", 5] }] },
//                 "$grandTotal",
//                 0,
//               ],
//             },
//           },
//           creditAmount: {
//             $sum: {
//               $cond: [
//                 { $and: [{ $eq: ["$bookingType", "credit"] }, { $ne: ["$bookingStatus", 5] }] },
//                 "$grandTotal",
//                 0,
//               ],
//             },
//           },
//           cancelAmount: {
//             $sum: {
//               $cond: [
//                 { $eq: ["$bookingStatus", 5] },
//                 "$grandTotal",
//                 0,
//               ],
//             },
//           },
//         },
//       },
//     ]);

//     // Step 2: Get delivery amounts by branch
//     const deliveryData = await Delivery.aggregate([
//       {
//         $match: {
//           companyId: new mongoose.Types.ObjectId(companyId),
//           deliveryDate: { $gte: start, $lte: end },
//         },
//       },
//       {
//         $group: {
//           _id: "$deliveryBranchName",
//           deliveryAmount: {
//             $sum: {
//               $toDouble: "$deliveryAmount", // In case stored as string
//             },
//           },
//         },
//       },
//     ]);

//     const deliveryMap = {};
//     for (const d of deliveryData) {
//       deliveryMap[d._id] = d.deliveryAmount;
//     }

//     // Step 3: Merge Booking + Delivery
//     const reportData = bookingData.map((b) => {
//       const deliveryAmount = deliveryMap[b._id] || 0;
//       return {
//         branchName: b._id,
//         paidAmount: b.paidAmount,
//         toPayAmount: b.toPayAmount,
//         creditAmount: b.creditAmount,
//         cancelAmount: b.cancelAmount,
//         deliveryAmount,
//         netAmount: b.paidAmount + b.creditAmount + deliveryAmount - b.cancelAmount,
//       };
//     });

//     if (!reportData.length) {
//       return res.status(404).json({ message: "No bookings found." });
//     }

//     // Step 4: Summary
//     const summary = reportData.reduce((acc, curr) => {
//       acc.finalPaidAmount += curr.paidAmount;
//       acc.finalToPayAmount += curr.toPayAmount;
//       acc.finalCreditAmount += curr.creditAmount;
//       acc.finalDeliveryAmount += curr.deliveryAmount;
//       acc.finalCancelAmount += curr.cancelAmount;
//       acc.finalNetAmount += curr.netAmount;
//       return acc;
//     }, {
//       finalPaidAmount: 0,
//       finalToPayAmount: 0,
//       finalCreditAmount: 0,
//       finalDeliveryAmount: 0,
//       finalCancelAmount: 0,
//       finalNetAmount: 0,
//     });

//     res.status(200).json({
//       branches: reportData,
//       ...summary,
//     });

//   } catch (err) {
//     console.error("Error generating report:", err);
//     res.status(500).json({ error: err.message });
//   }
// };


const allCollectionReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const filter = {
      bookingDate: { $gte: start, $lte: end },
      companyId: new mongoose.Types.ObjectId(companyId),
    };

    if (fromCity) filter.fromCity = fromCity;
    if (pickUpBranch) filter.dropBranch = pickUpBranch; // ✅ Changed from pickUpBranch to dropBranch
    if (bookedBy) filter.bookedBy = new mongoose.Types.ObjectId(bookedBy);

    // Step 1: Aggregate Booking Data (include toPayDeliveredAmount)
    const bookingData = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$dropBranchname", // ✅ Grouping by dropBranchname
          paidAmount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$bookingType", "paid"] }, { $ne: ["$bookingStatus", 5] }] },
                "$grandTotal",
                0,
              ],
            },
          },
          toPayAmount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$bookingType", "toPay"] }, { $ne: ["$bookingStatus", 5] }] },
                "$grandTotal",
                0,
              ],
            },
          },
          creditAmount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$bookingType", "credit"] }, { $ne: ["$bookingStatus", 5] }] },
                "$grandTotal",
                0,
              ],
            },
          },
          cancelAmount: {
            $sum: {
              $cond: [
                { $eq: ["$bookingStatus", 5] },
                "$grandTotal",
                0,
              ],
            },
          },
          toPayDeliveredAmount: { $sum: "$toPayDeliveredAmount" }
        },
      },
    ]);

    // Step 2: Format report data
    const reportData = bookingData.map((b) => {
      const toPayDeliveredAmount = b.toPayDeliveredAmount || 0;

      return {
        branchName: b._id,
        paidAmount: b.paidAmount,
        toPayAmount: b.toPayAmount,
        creditAmount: b.creditAmount,
        cancelAmount: b.cancelAmount,
        toPayDeliveredAmount,
        netAmount: b.paidAmount  + toPayDeliveredAmount,
      };
    });

    if (!reportData.length) {
      return res.status(404).json({ message: "No bookings found." });
    }

    // Step 3: Calculate Summary
    const summary = reportData.reduce((acc, curr) => {
      acc.finalPaidAmount += curr.paidAmount;
      acc.finalToPayAmount += curr.toPayAmount;
      acc.finalCreditAmount += curr.creditAmount;
      acc.finalToPayDeliveredAmount += curr.toPayDeliveredAmount;
      acc.finalCancelAmount += curr.cancelAmount;
      acc.finalNetAmount += curr.netAmount;
      return acc;
    }, {
      finalPaidAmount: 0,
      finalToPayAmount: 0,
      finalCreditAmount: 0,
      finalToPayDeliveredAmount: 0,
      finalCancelAmount: 0,
      finalNetAmount: 0,
    });

    // Step 4: Send response
    res.status(200).json({
      branches: reportData,
      ...summary,
    });

  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ error: err.message });
  }
};


  




const bookingTypeWiseCollection = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const filter = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: { $ne: 5 }, // exclude cancelled
      companyId: new mongoose.Types.ObjectId(companyId),
    };
    if (fromCity) filter.fromCity = fromCity;
    if (pickUpBranch) filter.pickUpBranch = pickUpBranch;
    if (bookedBy) filter.bookedBy = bookedBy;

    const reportData = await Booking.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%d-%m-%Y", date: "$bookingDate" }
            },
            branch: "$pickUpBranchname"
          },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "paid"] }, "$grandTotal", 0]
            }
          },
          toPayAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "toPay"] }, "$grandTotal", 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          bookingDate: "$_id.date",
          branchName: "$_id.branch",
          paidAmount: 1,
          toPayAmount: 1,
          total: { $add: ["$paidAmount", "$toPayAmount"] }
        }
      },
      { $sort: { bookingDate: 1, branchName: 1 } }
    ]);

    if (!reportData.length) {
      return res.status(404).json({ message: "No bookings found." });
    }

    const summary = reportData.reduce((acc, curr) => {
      acc.finalPaidAmount += curr.paidAmount;
      acc.finalToPayAmount += curr.toPayAmount;
      acc.finalTotalAmount += curr.total;
      return acc;
    }, {
      finalPaidAmount: 0,
      finalToPayAmount: 0,
      finalTotalAmount: 0
    });

    res.status(200).json({
      data: reportData,
      ...summary
    });

  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ error: err.message });
  }
};

//.......................................................................................




// const parcelBranchConsolidatedReport = async (req, res) => {
//   try {
//     const { fromDate, toDate, fromCity, pickUpBranch } = req.body;
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res.status(401).json({ message: "Unauthorized: companyId missing" });
//     }

//     const from = new Date(fromDate + 'T00:00:00+05:30');
//     const to = new Date(toDate + 'T23:59:59+05:30');

//     const matchStage = {
//       bookingDate: { $gte: from, $lte: to },
//       companyId: new mongoose.Types.ObjectId(companyId)
//     };

//     if (pickUpBranch) {
//       matchStage.pickUpBranch = pickUpBranch;
//     }

//     if (fromCity) {
//       matchStage.fromCity = new RegExp(`^${fromCity}$`, 'i');
//     }

//     // ✅ Bookings Side
//     const bookingData = await Booking.aggregate([
//       { $match: matchStage },
//       {
//         $group: {
//           _id: {
//             branchCode: "$pickUpBranch",
//             branchName: "$pickUpBranchname",
//             bookingStatus: "$bookingStatus",
//             bookingType: "$bookingType"
//           },
//           grandTotal: { $sum: "$grandTotal" },
//           deliveryAmount: { $sum: "$deliveryAmount" },
//           toPayDeliveredAmount: { $sum: "$toPayDeliveredAmount" }
//         }
//       }
//     ]);

//     const branchMap = {};
//     const totals = {
//       finalPaidAmount: 0,
//       finalToPayAmount: 0,
//       finalCreditAmount: 0,
//       finalDeliveryAmount: 0,
//       finalCancelAmount: 0,
//       finalBookingTotal: 0,
//       finalTotal: 0,
//       finalToPayDeliveredAmount: 0
//     };

//     for (const record of bookingData) {
//       const { branchCode, branchName, bookingStatus, bookingType } = record._id;

//       if (!branchMap[branchCode]) {
//         branchMap[branchCode] = {
//           branchCode,
//           branchName,
//           paidAmount: 0,
//           toPayAmount: 0,
//           creditAmount: 0,
//           deliveryAmount: 0,
//           toPayDeliveredAmount: 0,
//           cancelAmount: 0,
//           bookingTotal: 0,
//           total: 0
//         };
//       }

//       const entry = branchMap[branchCode];

//       if (bookingType === "paid") {
//         entry.paidAmount += record.grandTotal;
//         totals.finalPaidAmount += record.grandTotal;
//       }
//       if (bookingType === "credit") {
//         entry.creditAmount += record.grandTotal;
//         totals.finalCreditAmount += record.grandTotal;
//       }
//       if (bookingStatus === 5) {
//         entry.cancelAmount += record.grandTotal;
//         totals.finalCancelAmount += record.grandTotal;
//       }
//       if (bookingType === "toPay") {
//         entry.toPayAmount += record.grandTotal;
//         totals.finalToPayAmount += record.grandTotal;
//       }

//       entry.deliveryAmount += record.deliveryAmount;
//       totals.finalDeliveryAmount += record.deliveryAmount;

//       entry.toPayDeliveredAmount += record.toPayDeliveredAmount;
//       totals.finalToPayDeliveredAmount += record.toPayDeliveredAmount;
//     }

//     // ✅ Delivery Side
//     const deliveryData = await Booking.aggregate([
//       {
//         $match: {
//           bookingDate: { $gte: from, $lte: to },
//           companyId: new mongoose.Types.ObjectId(companyId),
//           bookingType: "toPay",
//           toPayDeliveredAmount: { $gt: 0 }
//         }
//       },
//       {
//         $group: {
//           _id: "$deliveryBranchName",
//           toPayDeliveredAmount: { $sum: "$toPayDeliveredAmount" }
//         }
//       }
//     ]);

//     for (const record of deliveryData) {
//       const branchName = record._id;
//       let found = false;

//       for (const entry of Object.values(branchMap)) {
//         if (entry.branchName === branchName) {
//           entry.toPayDeliveredAmount += record.toPayDeliveredAmount;
//           totals.finalToPayDeliveredAmount += record.toPayDeliveredAmount;
//           found = true;
//           break;
//         }
//       }

//       if (!found && branchName) {
//         branchMap[branchName] = {
//           branchCode: "-",
//           branchName,
//           paidAmount: 0,
//           toPayAmount: 0,
//           creditAmount: 0,
//           deliveryAmount: 0,
//           toPayDeliveredAmount: record.toPayDeliveredAmount,
//           cancelAmount: 0,
//           bookingTotal: 0,
//           total: 0
//         };
//         totals.finalToPayDeliveredAmount += record.toPayDeliveredAmount;
//       }
//     }

//     for (const entry of Object.values(branchMap)) {
//       entry.bookingTotal = entry.paidAmount + entry.toPayAmount + entry.creditAmount;
//       entry.total = entry.paidAmount + entry.deliveryAmount;
//       totals.finalBookingTotal += entry.bookingTotal;
//       totals.finalTotal += entry.total;
//     }

//     res.status(200).json({
//       data: Object.values(branchMap),
//       ...totals
//     });

//   } catch (err) {
//     console.error("Error in parcelBranchConsolidatedReport:", err);
//     res.status(500).json({ message: "Server Error", error: err.message });
//   }
// };


const parcelBranchConsolidatedReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, pickUpBranch } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: companyId missing" });
    }

    const from = new Date(fromDate + 'T00:00:00+05:30');
    const to = new Date(toDate + 'T23:59:59+05:30');

    const matchStage = {
      bookingDate: { $gte: from, $lte: to },
      companyId: new mongoose.Types.ObjectId(companyId)
    };

    if (pickUpBranch) {
      matchStage.pickUpBranch = pickUpBranch;
    }

    if (fromCity) {
      matchStage.fromCity = new RegExp(`^${fromCity}$`, 'i');
    }

    // Bookings Side
    const bookingData = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            branchCode: "$pickUpBranch",
            branchName: "$pickUpBranchname",
            bookingStatus: "$bookingStatus",
            bookingType: "$bookingType"
          },
          grandTotal: { $sum: "$grandTotal" },
          toPayDeliveredAmount: { $sum: "$toPayDeliveredAmount" }
        }
      }
    ]);

    const branchMap = {};
    const totals = {
      finalPaidAmount: 0,
      finalToPayAmount: 0,
      finalCreditAmount: 0,
      finalCancelAmount: 0,
      finalBookingTotal: 0,
      finalTotal: 0,
      finalToPayDeliveredAmount: 0
    };

    for (const record of bookingData) {
      const { branchCode, branchName, bookingStatus, bookingType } = record._id;

      if (!branchMap[branchCode]) {
        branchMap[branchCode] = {
          branchCode,
          branchName,
          paidAmount: 0,
          toPayAmount: 0,
          creditAmount: 0,
          toPayDeliveredAmount: 0,
          cancelAmount: 0,
          bookingTotal: 0,
          total: 0
        };
      }

      const entry = branchMap[branchCode];

      if (bookingType === "paid") {
        entry.paidAmount += record.grandTotal;
        totals.finalPaidAmount += record.grandTotal;
      }
      if (bookingType === "credit") {
        entry.creditAmount += record.grandTotal;
        totals.finalCreditAmount += record.grandTotal;
      }
      if (bookingStatus === 5) {
        entry.cancelAmount += record.grandTotal;
        totals.finalCancelAmount += record.grandTotal;
      }
      if (bookingType === "toPay") {
        entry.toPayAmount += record.grandTotal;
        totals.finalToPayAmount += record.grandTotal;
      }

      entry.toPayDeliveredAmount += record.toPayDeliveredAmount;
      totals.finalToPayDeliveredAmount += record.toPayDeliveredAmount;
    }

    // ✅ Proper Delivery Side Filtering (using variable construction)
    const deliveryMatch = {
      bookingDate: { $gte: from, $lte: to },
      companyId: new mongoose.Types.ObjectId(companyId),
      bookingType: "toPay",
      toPayDeliveredAmount: { $gt: 0 }
    };

    if (pickUpBranch) {
      deliveryMatch.pickUpBranch = pickUpBranch;
    }

    const deliveryData = await Booking.aggregate([
      { $match: deliveryMatch },
      {
        $group: {
          _id: "$deliveryBranchName",
          toPayDeliveredAmount: { $sum: "$toPayDeliveredAmount" }
        }
      }
    ]);

    for (const record of deliveryData) {
      const branchName = record._id;
      let found = false;

      for (const entry of Object.values(branchMap)) {
        if (entry.branchName === branchName) {
          entry.toPayDeliveredAmount += record.toPayDeliveredAmount;
          totals.finalToPayDeliveredAmount += record.toPayDeliveredAmount;
          found = true;
          break;
        }
      }

      if (!found && branchName) {
        // ❌ This block will no longer run for branches not part of pickUpBranch
        // So "Auto Nagar" won't appear
        continue;
      }
    }

    for (const entry of Object.values(branchMap)) {
      entry.bookingTotal = entry.paidAmount + entry.toPayAmount + entry.creditAmount;
      entry.total = entry.paidAmount + entry.toPayDeliveredAmount;
      totals.finalBookingTotal += entry.bookingTotal;
      totals.finalTotal += entry.total;
    }

    return res.status(200).json({
      data: Object.values(branchMap),
      ...totals
    });

  } catch (err) {
    console.error("Error in parcelBranchConsolidatedReport:", err);
    return res.status(500).json({ message: "Server Error", error: err.message });
  }
};




const consolidatedReportBranch = async (req, res) => {
  try {
    const { fromDate, toDate } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: companyId missing" });
    }

    const matchStage = {
      bookingDate: { $ne: null },
      companyId: new mongoose.Types.ObjectId(companyId)
    };

    if (fromDate && toDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      matchStage.bookingDate = { $gte: from, $lte: to };
    }

    // Booked ToPay Details
    const bookedToPay = await Booking.aggregate([
      { $match: { ...matchStage, bookingStatus: 0, bookingType: "toPay" } },
      {
        $group: {
          _id: null,
          finalPackages: { $sum: { $size: "$packages" } },
          finalServiceCharges: { $sum: "$serviceCharges" },
          finalDoorDeliveryCharges: { $sum: "$doorDeliveryCharges" },
          finalOtherCharges: { $sum: "$otherCharges" },
          finalGrandTotal: { $sum: "$grandTotal" },
          records: { $push: "$ROOT" }
        }
      }
    ]);

    // Delivered ToPay Details
    const deliveredToPay = await Booking.aggregate([
      { $match: { ...matchStage, bookingStatus: 4, bookingType: "toPay" } },
      {
        $group: {
          _id: null,
          finalPackages: { $sum: { $size: "$packages" } },
          finalServiceCharges: { $sum: "$serviceCharges" },
          finalDoorDeliveryCharges: { $sum: "$doorDeliveryCharges" },
          finalOtherCharges: { $sum: "$otherCharges" },
          finalGrandTotal: { $sum: "$grandTotal" },
          records: { $push: "$ROOT" }
        }
      }
    ]);

    // City Wise Booking Details
    const cityWiseBooking = await Booking.aggregate([
      { $match: { ...matchStage, bookingStatus: 0 } },
      {
        $group: {
          _id: "$fromCity",
          noOfParcels: { $sum: { $size: "$packages" } },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "paid"] }, "$grandTotal", 0]
            }
          },
          toPayAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "toPay"] }, "$grandTotal", 0]
            }
          },
          FOCAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "FOC"] }, "$grandTotal", 0]
            }
          },
          creditAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "credit"] }, "$grandTotal", 0]
            }
          },
          totalBookingAmount: { $sum: "$grandTotal" },
          totalCancelAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 5] }, "$grandTotal", 0]
            }
          }
        }
      }
    ]);

    // City Wise Delivery Details
    const cityWiseDelivery = await Booking.aggregate([
      { $match: { ...matchStage, bookingStatus: 4 } },
      {
        $group: {
          _id: "$fromCity",
          noOfParcels: { $sum: { $size: "$packages" } },
          paidAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "paid"] }, "$grandTotal", 0]
            }
          },
          toPayAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "toPay"] }, "$grandTotal", 0]
            }
          },
          FOCAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "FOC"] }, "$grandTotal", 0]
            }
          },
          creditAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingType", "credit"] }, "$grandTotal", 0]
            }
          },
          totalBookingAmount: { $sum: "$grandTotal" },
          totalCancelAmount: {
            $sum: {
              $cond: [{ $eq: ["$bookingStatus", 5] }, "$grandTotal", 0]
            }
          }
        }
      }
    ]);

    // Category Wise Booking Details
    const categoryWiseBooking = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$bookingType",
          noOfPackages: { $sum: { $size: "$packages" } },
          serviceCharge: { $sum: "$serviceCharges" },
          doorDeliveryCharges: { $sum: "$doorDeliveryCharges" },
          doorPickupCharges: { $sum: "$doorPickupCharges" },
          otherCharges: { $sum: "$otherCharges" }
        }
      }
    ]);

    res.json({
      bookedToPayDetails: bookedToPay[0] || {},
      deliveredToPayDetails: deliveredToPay[0] || {},
      cityWiseBookingDetails: cityWiseBooking,
      cityWiseDeliveryDetails: cityWiseDelivery,
      categoryWiseBookingDetails: categoryWiseBooking
    });
  } catch (err) {
    console.error("Report Error:", err);
    res.status(500).json({ error: err.message });
  }
};


const parcelBranchWiseGSTReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, pickUpBranch } = req.body;

    // Validate required date parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide required parameters: fromDate and toDate",
      });
    }

    // Enforce condition: if fromCity is "all" or missing, pickUpBranch must also be "all" or missing
    const isCityAll = !fromCity || fromCity.toLowerCase() === "all";
    const isBranchAll = !pickUpBranch || pickUpBranch.toLowerCase() === "all";

    if (isCityAll && !isBranchAll) {
      return res.status(400).json({
        success: false,
        message:
          'When selecting all cities, Branch must be "select all" or omitted',
      });
    }

    // Convert dates and set endDate time to end of day
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    // Build the initial $match query dynamically
    const matchQuery = {
      bookingDate: { $gte: startDate, $lte: endDate },
      // Add companyId if your Booking schema has it (recommended)
      companyId,
    };

    // Add fromCity to query only if provided and not "all"
    if (!isCityAll) {
      matchQuery.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") }; // Case-insensitive exact match
    }

    // Add pickUpBranch to query only if provided and not "all"
    if (!isBranchAll) {
      // Adjust the field name as per your schema (pickUpBranch or pickUpBranchname)
      matchQuery.pickUpBranch = { $regex: new RegExp(`^${pickUpBranch}$`, "i") };
    }

    // Aggregation pipeline with facet to get GST breakdown by booking types and statuses
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

    // Provide defaults if no data found
    const bookingGST = result?.bookingGST[0] ?? { total: 0, count: 0 };
    const deliveryGST = result?.deliveryGST[0] ?? { total: 0, count: 0 };
    const creditGST = result?.creditGST[0] ?? { total: 0, count: 0 };

    const totalGST = bookingGST.total + deliveryGST.total + creditGST.total;
    const totalBookings = bookingGST.count + deliveryGST.count + creditGST.count;

    return res.status(200).json({
      success: true,
      data: {
        bookingGST: { amount: bookingGST.total, count: bookingGST.count },
        deliveryGST: { amount: deliveryGST.total, count: deliveryGST.count },
        creditGST: { amount: creditGST.total, count: creditGST.count },
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
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


const senderReceiverGSTReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, branchCity, branchName } = req.body;

    // Validate date input
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "fromDate and toDate are required",
      });
    }

    // Parse dates and set endDate to end of day
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    // Build query with mandatory date filter and optional filters
    const query = {
      bookingDate: { $gte: startDate, $lte: endDate },
      companyId, // include companyId to scope bookings to user’s company
    };

    if (branchCity) {
      query.fromCity = { $regex: new RegExp(`^${branchCity}$`, "i") }; // Case-insensitive exact match
    }

    if (branchName) {
      query.pickUpBranch = { $regex: new RegExp(`^${branchName}$`, "i") }; // Case-insensitive exact match
    }

    // Fetch matching bookings, selecting only relevant fields
    const bookings = await Booking.find(query).select(
      "grnNo bookingDate senderName receiverName bookingType ltDate senderGst receiverGst fromCity toCity totalQuantity grandTotal parcelGstAmount"
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: true,
        message: "No bookings found for the given criteria",
        bookings: [],
        finalTotalQuantity: 0,
        finalGrandTotal: 0,
        finalGstTotalAmount: 0,
      });
    }

    // Calculate totals safely using reduce
    const finalTotalQuantity = bookings.reduce(
      (sum, b) => sum + (b.totalQuantity || 0),
      0
    );

    const finalGrandTotal = bookings.reduce(
      (sum, b) => sum + (b.grandTotal || 0),
      0
    );

    const finalGstTotalAmount = bookings.reduce(
      (sum, b) => sum + (b.parcelGstAmount || 0),
      0
    );

    // Send response with bookings and totals
    return res.status(200).json({
      success: true,
      bookings,
      finalTotalQuantity,
      finalGrandTotal,
      finalGstTotalAmount,
    });
  } catch (error) {
    console.error("Error in senderReceiverGSTReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const markParcelAsMissing = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { grnNo } = req.params;
    const { missingReason, missingDate, missingByUser } = req.body;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const booking = await Booking.findOne({ grnNo, companyId });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Already cancelled or delivered check
    if (booking.bookingStatus === 4) {
      return res.status(400).json({ success: false, message: "Parcel already delivered" });
    }
    if (booking.bookingStatus === 5) {
      return res.status(400).json({ success: false, message: "Parcel already cancelled" });
    }

    // Update booking status to missing
    booking.bookingStatus = 3;
    booking.missingReason = missingReason || "Unknown";
    booking.missingDate = missingDate ? new Date(missingDate) : new Date();
    booking.missingByUser = missingByUser || req.user.name || "System";

    await booking.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Parcel marked as missing successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error in markParcelAsMissing:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



const parcelStatusDateDifferenceReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { startDate, endDate, fromCity, toCity, bookingStatus } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the whole end day

    // Build query
    const query = {
      bookingDate: { $gte: start, $lte: end },
      companyId, // Ensure filtering by company
    };

    if (fromCity) query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };
    if (bookingStatus !== "all") query.bookingStatus = bookingStatus;


    // Select required fields
    const bookings = await Booking.find(query).select(
      "grnNo lrNumber bookingDate loadingDate unloadingDate deliveryDate deliveryEmployee fromCity toCity bookingStatus parcelGstAmount"
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: true,
        data: [],
        message: "No bookings found for the given criteria",
      });
    }

    return res.status(200).json({
      success: true,
      data: bookings,
      message: "Parcel bookings report generated successfully",
    });
  } catch (error) {
    console.error("Error generating parcel status report:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};



const pendingDeliveryStockReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    const { fromCity, toCity, pickUpBranch, dropBranch, fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "fromDate and toDate are required" });
    }

    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    const isFromCityAll = !fromCity || fromCity.toLowerCase() === "all";
    const isToCityAll = !toCity || toCity.toLowerCase() === "all";
    const isPickUpBranchAll = !pickUpBranch || pickUpBranch.toLowerCase() === "all";
    const isDropBranchAll = !dropBranch || dropBranch.toLowerCase() === "all";

    const query = {
      companyId: new mongoose.Types.ObjectId(companyId),
      bookingStatus: 2, // pending delivery
      bookingDate: { $gte: startDate, $lte: endDate },
    };

    if (!isFromCityAll) query.fromCity = fromCity;
    if (!isToCityAll) query.toCity = toCity;
    if (!isPickUpBranchAll) query.pickUpBranch = pickUpBranch;
    if (!isDropBranchAll) query.dropBranch = dropBranch;

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
                totalQuantity: {
                  $sum: {
                    $reduce: {
                      input: "$packages",
                      initialValue: 0,
                      in: { $add: ["$$value", "$$this.quantity"] },
                    },
                  },
                },
                grandTotalSum: { $sum: "$grandTotal" },
              },
            },
          ],
          byBookingType: [
            {
              $group: {
                _id: "$bookingType",
                totalRecords: { $sum: 1 },
                totalQuantity: {
                  $sum: {
                    $reduce: {
                      input: "$packages",
                      initialValue: 0,
                      in: { $add: ["$$value", "$$this.quantity"] },
                    },
                  },
                },
                grandTotalSum: { $sum: "$grandTotal" },
              },
            },
          ],
        },
      },
    ]);

    const totalData = result?.totalData?.[0] ?? {
      totalRecords: 0,
      totalQuantity: 0,
      grandTotalSum: 0,
    };

    const byBookingTypeRaw = result?.byBookingType ?? [];
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

    // Include other booking types dynamically
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
      "Received Date": booking.bookingDate ? new Date(booking.bookingDate).toLocaleDateString() : "",
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
        ? Math.floor((new Date() - new Date(booking.bookingDate)) / (1000 * 3600 * 24))
        : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        message:
          totalData.totalRecords > 0
            ? "Pending delivery stock report generated"
            : `No data found for the selected filters${
                !isFromCityAll ? ` (fromCity: ${fromCity})` : ""
              }${!isToCityAll ? ` (toCity: ${toCity})` : ""}${
                !isPickUpBranchAll ? ` (pickUpBranch: ${pickUpBranch})` : ""
              }${!isDropBranchAll ? ` (dropBranch: ${dropBranch})` : ""}`,
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
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};




// const pendingDeliveryLuggageReport = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
//     }

//     const {
//       fromDate,
//       toDate,
//       fromCity,
//       toCity,
//       pickUpBranch,
//       dropBranch,
//       bookingType,
//     } = req.body;

//     if (!fromDate || !toDate) {
//       return res.status(400).json({ success: false, message: "fromDate and toDate are required" });
//     }

//     const start = new Date(fromDate);
//     const end = new Date(toDate);
//     end.setHours(23, 59, 59, 999);

//     const query = {
//       companyId,
//       bookingDate: { $gte: start, $lte: end },
//       bookingStatus: 2,
//     };

//     if (fromCity) query.fromCity = fromCity;
//     if (toCity) query.toCity = toCity;
//     if (pickUpBranch) query.pickUpBranch = pickUpBranch;
//     if (dropBranch) query.dropBranch = dropBranch;
//     if (bookingType) query.bookingType = bookingType;

//     const pendingDeliveries = await Booking.find(query)
//       .select(
//         "grnNo unloadingDate fromCity toCity senderName senderMobile receiverName bookingType packages bookingDate"
//       )
//       .lean();

//     if (!pendingDeliveries.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No pending deliveries found for the given criteria",
//       });
//     }

//     let serial = 1;
//     let grandTotalQuantity = 0;
//     let grandTotalAmount = 0;

//     const formattedDeliveries = pendingDeliveries.map((delivery) => {
//       const {
//         grnNo,
//         unloadingDate,
//         fromCity,
//         toCity,
//         senderName,
//         senderMobile,
//         receiverName,
//         bookingType,
//         packages,
//         bookingDate,
//       } = delivery;

//       let totalQuantity = 0;
//       let totalAmount = 0;
//       let itemNameFields = {};

//       if (Array.isArray(packages)) {
//         packages.forEach((pkg, index) => {
//           const quantity = pkg.quantity || 0;
//           const amount = pkg.totalPrice || 0;

//           totalQuantity += quantity;
//           totalAmount += amount;

//           const fieldName = `itemName${index + 1}`;
//           itemNameFields[fieldName] = `${pkg.packageType} (${quantity})`;
//         });
//       }

//       grandTotalQuantity += totalQuantity;
//       grandTotalAmount += totalAmount;

//       // Calculate days difference from bookingDate to today
//       const dayDiff = bookingDate
//         ? Math.floor((new Date() - new Date(bookingDate)) / (1000 * 60 * 60 * 24))
//         : 0;

//       return {
//         srNo: serial++,
//         grnNo,
//         receiverDate: unloadingDate
//           ? new Date(unloadingDate).toLocaleDateString("en-GB")
//           : "NA",
//         source: fromCity,
//         destination: toCity,
//         consignor: senderName,
//         consignee: receiverName,
//         consigneeNo: senderMobile,
//         bookingType,
//         dayDiff,
//         ...itemNameFields,
//         quantity: totalQuantity,
//         amount: totalAmount,
//       };
//     });

//     res.status(200).json({
//       success: true,
//       message: "Pending delivery luggage report generated successfully",
//       data: {
//         formattedDeliveries,
//         grandTotalQuantity,
//         grandTotalAmount,
//       },
//     });
//   } catch (error) {
//     console.error("Error generating pending delivery report:", error);
//     res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };

const pendingDeliveryLuggageReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }

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
        .json({ success: false, message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const query = {
      companyId,
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
        "grnNo unloadingDate fromCity toCity senderName senderMobile receiverName bookingType packages bookingDate grandTotal"
      )
      .lean();

    if (!pendingDeliveries.length) {
      return res.status(404).json({
        success: false,
        message: "No pending deliveries found for the given criteria",
      });
    }

    let serial = 1;
    let grandTotalQuantity = 0;
    let grandTotalAmount = 0;

    const formattedDeliveries = pendingDeliveries.map((delivery) => {
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
        bookingDate,
        grandTotal,
      } = delivery;

      let totalQuantity = 0;
      let itemNameFields = {};

      if (Array.isArray(packages)) {
        packages.forEach((pkg, index) => {
          const quantity = pkg.quantity || 0;
          totalQuantity += quantity;

          const fieldName = `itemName${index + 1}`;
          itemNameFields[fieldName] = `${pkg.packageType} (${quantity})`;
        });
      }

      const totalAmount = grandTotal || 0;
      grandTotalQuantity += totalQuantity;
      grandTotalAmount += totalAmount;

      const dayDiff = bookingDate
        ? Math.floor(
            (new Date() - new Date(bookingDate)) / (1000 * 60 * 60 * 24)
          )
        : 0;

      return {
        srNo: serial++,
        grnNo,
        receiverDate: unloadingDate
          ? new Date(unloadingDate).toLocaleDateString("en-GB")
          : "NA",
        source: fromCity,
        destination: toCity,
        consignor: senderName,
        consignee: receiverName,
        consigneeNo: senderMobile,
        bookingType,
        dayDiff,
        ...itemNameFields,
        quantity: totalQuantity,
        amount: totalAmount,
      };
    });

    res.status(200).json({
      success: true,
      message: "Pending delivery luggage report generated successfully",
      data: {
        formattedDeliveries,
        grandTotalQuantity,
        grandTotalAmount,
      },
    });
  } catch (error) {
    console.error("Error generating pending delivery report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


const parcelReceivedStockReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

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
      return res.status(400).json({
        success: false,
        message: "fromDate and toDate are required",
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Step 1: Get grnNo list from ParcelUnloading with companyId filter
    const unloadingGrns = await ParcelUnloading.find({
      companyId,
      unloadingDate: { $gte: start, $lte: end },
    })
      .select("grnNo -_id")
      .lean();

    // FIX: grnNo is an array, so we flatten it
    const grnNos = unloadingGrns
      .flatMap(item => item.grnNo)
      .map(grn => Number(grn))
      .filter(grn => !isNaN(grn));

    if (!grnNos.length) {
      return res.status(404).json({
        success: false,
        message: "No GRNs found in ParcelUnloading for given date range",
      });
    }

    // Step 2: Build Booking Query with companyId
    const query = {
      companyId,
      grnNo: { $in: grnNos },
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
      return res.status(404).json({
        success: false,
        message: "No bookings found for the given criteria",
      });
    }

    let totalGrandTotal = 0;
    let grandTotalPackages = 0;
    const updatedDeliveries = [];

    const bookingTypeSummary = {
      paid: {
        fromCity: "",
        pickupBranchName: "",
        totalAmount: 0,
      },
      toPay: {
        fromCity: "",
        pickupBranchName: "",
        totalAmount: 0,
      },
    };

    let finalTotalToPay = 0;
    let finalTotalPaid = 0;

    for (const delivery of bookings) {
      const grandTotal =
        delivery.packages?.reduce((sum, pkg) => sum + (pkg.totalPrice || 0), 0) || 0;

      const totalPackages = delivery.packages?.length || 0;
      totalGrandTotal += grandTotal;
      grandTotalPackages += totalPackages;

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
        totalPackages,
        grandTotal,
      });

      const type = delivery.bookingType;

      if (bookingTypeSummary[type]) {
        if (!bookingTypeSummary[type].fromCity) {
          bookingTypeSummary[type].fromCity = delivery.fromCity || "";
        }
        if (!bookingTypeSummary[type].pickupBranchName) {
          bookingTypeSummary[type].pickupBranchName = delivery.pickUpBranch || "";
        }
        bookingTypeSummary[type].totalAmount += grandTotal;
      }

      if (type === "toPay") finalTotalToPay += grandTotal;
      if (type === "paid") finalTotalPaid += grandTotal;
    }

    return res.status(200).json({      
      
        data: updatedDeliveries,
        totalGrandTotal,
        grandTotalPackages,
        bookingTypeSummary,
        finalTotalToPay,
        finalTotalPaid,
      
    });
  } catch (error) {
    console.error("Error in parcelReceivedStockReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// const deliveredStockReport = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized: Company ID missing",
//       });
//     }

//     const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

//     if (!fromDate || !toDate) {
//       return res.status(400).json({
//         success: false,
//         message: "fromDate and toDate are required",
//       });
//     }

//     const start = new Date(fromDate + 'T00:00:00+05:30');
//     const end = new Date(toDate + 'T23:59:59+05:30');

//     let query = {
//       companyId,
//       deliveryDate: { $gte: start, $lte: end },
//       bookingStatus: 4,
//     };

//     if (fromCity) query.fromCity = fromCity;
//     if (toCity) query.toCity = toCity;
//     if (pickUpBranch) query.pickUpBranch = pickUpBranch;
//     if (dropBranch) query.dropBranch = dropBranch;

//     const stockReport = await Booking.find(query)
//       .select(
//         "grnNo lrNumber deliveryEmployee grandTotal fromCity pickUpBranchname senderName senderMobile bookingType receiverName packages.packageType packages.quantity packages.totalPrice parcelGstAmount serviceCharges hamaliCharges doorDeliveryCharges doorPickupCharges"
//       )
//       .lean();

//     if (!stockReport.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No stock found for the given criteria",
//       });
//     }

//     // Totals
//     let totalPackagesSum = 0;
//     let totalFreight = 0;
//     let totalGST = 0;
//     let totalOtherCharges = 0;
//     let totalDeliveryCharges = 0;
//     let totalNetAmount = 0;

//     const bookingTypeSummary = {
//       Paid: { freight: 0, gst: 0, otherCharges: 0, doorDeliveryCharges: 0, credit: 0, netAmount: 0 },
//       ToPay: { freight: 0, gst: 0, otherCharges: 0, doorDeliveryCharges: 0, credit: 0, netAmount: 0 },
//       Credit: { freight: 0, gst: 0, otherCharges: 0, doorDeliveryCharges: 0, credit: 0, netAmount: 0 },
//     };

//     const updatedDeliveries = stockReport.map((delivery, index) => {
//       const {
//         lrNumber,
//         deliveryEmployee,
//         grandTotal = 0,
//         fromCity,
//         pickUpBranchname,
//         senderName,
//         bookingType,
//         receiverName,
//         packages = [],
//         parcelGstAmount = 0,
//         serviceCharges = 0,
//         hamaliCharges = 0,
//         doorDeliveryCharges = 0,
//         doorPickupCharges = 0,
//       } = delivery;

//      const pkgCount = packages.reduce((sum, pkg) => sum + (pkg.quantity || 0), 0);

//       const freight = packages.reduce((sum, pkg) => sum + (pkg.totalPrice || 0), 0);
//       const otherCharges = serviceCharges + hamaliCharges + doorPickupCharges;
//       const netAmount = grandTotal;

//       totalPackagesSum += pkgCount;
//       totalFreight += freight;
//       totalGST += parcelGstAmount;
//       totalOtherCharges += otherCharges;
//       totalDeliveryCharges += doorDeliveryCharges || 0;
//       totalNetAmount += netAmount;

//       let normalizedType = (bookingType || "").toLowerCase();
//       if (normalizedType === "paid") normalizedType = "Paid";
//       else if (normalizedType === "topay" || normalizedType === "toPay") normalizedType = "ToPay";
//       else if (normalizedType === "credit") normalizedType = "Credit";
//       else return null;

//       bookingTypeSummary[normalizedType].freight += freight;
//       bookingTypeSummary[normalizedType].gst += parcelGstAmount;
//       bookingTypeSummary[normalizedType].otherCharges += otherCharges;
//       bookingTypeSummary[normalizedType].doorDeliveryCharges += doorDeliveryCharges || 0;
//       bookingTypeSummary[normalizedType].credit += normalizedType === "Credit" ? grandTotal : 0;
//       bookingTypeSummary[normalizedType].netAmount += netAmount;

//       const parcelItems = packages
//         .map((pkg) => `${pkg.quantity || 0}-${pkg.packageType || ""}`)
//         .join(", ");

//       return {
//         SrNo: index + 1,
//         WBNo: lrNumber,
//         SourceSubregion: `${fromCity} (${pickUpBranchname})`,
//         ReceivedBy: deliveryEmployee,
//         Consigner: senderName,
//         Consignee: receiverName,
//         WBType: normalizedType,
//         ParcelItem: parcelItems,
//         Pkgs: pkgCount, 
//         Amount: grandTotal,
//       };
//     }).filter(Boolean);

//     return res.status(200).json({
//       success: true,
//       message: "Delivered stock report generated successfully",
//       data: {
//         deliveries: updatedDeliveries,
//         summary: {
//           totalPackages: totalPackagesSum,
//           totalFreight,
//           totalGST,
//           totalOtherCharges,
//           totalDeliveryCharges,
//           totalNetAmount,
//           bookingTypeSummary,
//         },
//       },
//     });
//   } catch (error) {
//     console.error("Error in deliveredStockReport:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// };


const deliveredStockReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "fromDate and toDate are required",
      });
    }

    const start = new Date(fromDate + 'T00:00:00+05:30');
    const end = new Date(toDate + 'T23:59:59+05:30');

    let query = {
      companyId,
      deliveryDate: { $gte: start, $lte: end },
      bookingStatus: 4,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    const stockReport = await Booking.find(query)
      .select(
        "grnNo lrNumber deliveryEmployee grandTotal fromCity pickUpBranchname senderName senderMobile bookingType receiverName packages.packageType packages.quantity packages.totalPrice parcelGstAmount serviceCharges hamaliCharges doorDeliveryCharges doorPickupCharges toPayDeliveredAmount toPayDeliveryAmount"
      )
      .lean();

    if (!stockReport.length) {
      return res.status(404).json({
        success: false,
        message: "No stock found for the given criteria",
      });
    }

    let totalPackagesSum = 0;
    let totalFreight = 0;
    let totalGST = 0;
    let totalOtherCharges = 0;
    let totalDeliveryCharges = 0;
    let totalNetAmount = 0;

    const bookingTypeSummary = {
      Paid: { freight: 0, gst: 0, otherCharges: 0, doorDeliveryCharges: 0, credit: 0, netAmount: 0 },
      ToPay: { freight: 0, gst: 0, otherCharges: 0, doorDeliveryCharges: 0, credit: 0, netAmount: 0 },
      Credit: { freight: 0, gst: 0, otherCharges: 0, doorDeliveryCharges: 0, credit: 0, netAmount: 0 },
    };

    const updatedDeliveries = stockReport.map((delivery, index) => {
      const {
        lrNumber,
        deliveryEmployee,
        grandTotal = 0,
        fromCity,
        pickUpBranchname,
        senderName,
        bookingType,
        receiverName,
        packages = [],
        parcelGstAmount = 0,
        serviceCharges = 0,
        hamaliCharges = 0,
        doorDeliveryCharges = 0,
        doorPickupCharges = 0,
        toPayDeliveredAmount = 0,
        toPayDeliveryAmount = 0,
      } = delivery;

      const pkgCount = packages.reduce((sum, pkg) => sum + (pkg.quantity || 0), 0);
      const freight = packages.reduce((sum, pkg) => sum + (pkg.totalPrice || 0), 0);
      const otherCharges = serviceCharges + hamaliCharges + doorPickupCharges;

      // ✅ Net amount includes Paid + ToPayDeliveredAmount + ToPayDeliveryAmount
      const netAmount = grandTotal + toPayDeliveredAmount + toPayDeliveryAmount;

      totalPackagesSum += pkgCount;
      totalFreight += freight;
      totalGST += parcelGstAmount;
      totalOtherCharges += otherCharges;
      totalDeliveryCharges += doorDeliveryCharges || 0;
      totalNetAmount += netAmount;

      let normalizedType = (bookingType || "").toLowerCase();
      if (normalizedType === "paid") normalizedType = "Paid";
      else if (normalizedType === "topay" || normalizedType === "toPay") normalizedType = "ToPay";
      else if (normalizedType === "credit") normalizedType = "Credit";
      else return null;

      bookingTypeSummary[normalizedType].freight += freight;
      bookingTypeSummary[normalizedType].gst += parcelGstAmount;
      bookingTypeSummary[normalizedType].otherCharges += otherCharges;
      bookingTypeSummary[normalizedType].doorDeliveryCharges += doorDeliveryCharges || 0;
      bookingTypeSummary[normalizedType].credit += normalizedType === "Credit" ? grandTotal : 0;
      bookingTypeSummary[normalizedType].netAmount += netAmount;

      const parcelItems = packages
        .map((pkg) => `${pkg.quantity || 0}-${pkg.packageType || ""}`)
        .join(", ");

      return {
        SrNo: index + 1,
        WBNo: lrNumber,
        SourceSubregion: `${fromCity} (${pickUpBranchname})`,
        ReceivedBy: deliveryEmployee,
        Consigner: senderName,
        Consignee: receiverName,
        WBType: normalizedType,
        ParcelItem: parcelItems,
        Pkgs: pkgCount,
        Amount: netAmount,
      };
    }).filter(Boolean);

    return res.status(200).json({
      success: true,
      message: "Delivered stock report generated successfully",
      data: {
        deliveries: updatedDeliveries,
        summary: {
          totalPackages: totalPackagesSum,
          totalFreight,
          totalGST,
          totalOtherCharges,
          totalDeliveryCharges,
          totalNetAmount,
          bookingTypeSummary,
        },
      },
    });
  } catch (error) {
    console.error("Error in deliveredStockReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
  


const pendingDispatchStockReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromCity, toCity, pickUpBranch, fromDate, toDate } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "Both fromDate and toDate are required.",
      });
    }

    // Helper to capitalize first letter
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

    // Date range filter
    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Base query with companyId and date range
    let query = {
      companyId,
      bookingDate: { $gte: start, $lte: end },
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
        success: false,
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
      const weight =
        item.packages?.reduce((sum, pkg) => sum + (pkg.weight || 0), 0) || 0;
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

      bookings.push({
        wbNo: item.lrNumber,
        pkgs: item.totalPackages || 0,
        destination: item.toCity,
        sender: item.senderName,
        receiver: item.receiverName,
        receiverNo: item.receiverMobile,
        wbType: capitalize(bookingType),
        amount: item.grandTotal || 0,
        source: item.pickUpBranchname,
        receiptNo: item.receiptNo || "-",
        bookingDate: item.bookingDate,
        days: Math.max(
          0,
          Math.floor((new Date() - new Date(item.bookingDate)) / (1000 * 60 * 60 * 24))
        ),
      });
    }

    const bookingSummary = Object.entries(bookingTypeData).reduce(
      (acc, [type, entries]) => {
        const noa = entries.length; // Number of arrivals?
        const totalLR = noa; // Same as noa? Adjust if needed.
        const actualWeight = entries.reduce((sum, e) => sum + (e.totalWeight || 0), 0);
        const chargeWeight = 0; // TODO: implement if charge weight calculation is needed
        const totalAmount = entries.reduce((sum, e) => sum + (e.grandTotal || 0), 0);

        acc[type] = {
          noa,
          totalLR,
          actualWeight,
          chargeWeight,
          totalAmount,
        };
        return acc;
      },
      {}
    );

    return res.status(200).json({
    
        bookings,
        summary: bookingSummary,
        allTotalPackages,
        allTotalWeight,
        totalGrandTotalAmount,
    
    });
  } catch (error) {
    console.error("Error in pendingDispatchStockReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


const dispatchedMemoReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const {
      fromDate,
      toDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      vehicalNumber, // confirm spelling or use vehicleNumber
      bookingStatus,
    } = req.body;

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

    // Build base query with companyId and booking date range
    const query = {
      companyId,
      bookingDate: { $gte: start, $lte: end },
    };

    // Handle bookingStatus - treat 0 or false explicitly
    if (bookingStatus !== undefined && bookingStatus !== null && bookingStatus !== "") {
      query.bookingStatus = bookingStatus;
    } else {
      query.bookingStatus = 1; // Default status if none provided
    }

    if (fromCity && fromCity !== "all") query.fromCity = fromCity;
    if (toCity && toCity !== "all") query.toCity = toCity;
    if (pickUpBranch && pickUpBranch !== "all") query.pickUpBranch = pickUpBranch;
    if (dropBranch && dropBranch !== "all") query.dropBranch = dropBranch;
    if (vehicalNumber && vehicalNumber !== "all") query.vehicalNumber = vehicalNumber;

    const stockReport = await Booking.find(query)
      .select(
        "_id grnNo lrNumber vehicalNumber toCity serviceCharge hamaliCharge grandTotal senderName receiverName senderMobile loadingDate bookingDate bookingType packages.packageType packages.quantity totalPackages parcelGstAmount"
      )
      .lean();

    // Totals by booking type
    const totals = {
      paid: { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 },
      toPay: { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 },
      credit: { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 },
    };

    const groupedData = {
      paid: [],
      toPay: [],
      credit: [],
    };

    const cityWise = {}; // cityName -> totals by type

    for (const item of stockReport) {
      const type = (item.bookingType || "other").toLowerCase();
      const city = item.toCity || "Unknown";

      // Ensure numeric values
      item.serviceCharge = Number(item.serviceCharge) || 0;
      item.hamaliCharge = Number(item.hamaliCharge) || 0;
      const totalAmount = Number(item.grandTotal) || 0;
      const qty = Number(item.totalPackages) || 1;

      // Initialize city if missing
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
        totals.paid.grandTotal += totalAmount;
        totals.paid.serviceCharge += item.serviceCharge;
        totals.paid.hamaliCharge += item.hamaliCharge;

        cityWise[city].paidQty += qty;
        cityWise[city].paidAmount += totalAmount;
      } else if (type === "topay" || type === "to pay") {
        groupedData.toPay.push(item);
        totals.toPay.grandTotal += totalAmount;
        totals.toPay.serviceCharge += item.serviceCharge;
        totals.toPay.hamaliCharge += item.hamaliCharge;

        cityWise[city].toPayQty += qty;
        cityWise[city].toPayAmount += totalAmount;
      } else if (type === "credit") {
        groupedData.credit.push(item);
        totals.credit.grandTotal += totalAmount;
        totals.credit.serviceCharge += item.serviceCharge;
        totals.credit.hamaliCharge += item.hamaliCharge;

        cityWise[city].creditQty += qty;
        cityWise[city].creditAmount += totalAmount;
      }
    }

    const cityWiseArray = Object.entries(cityWise).map(
      ([city, values], index) => ({
        srNo: index + 1,
        cityName: city,
        paidQty: values.paidQty,
        paidAmount: values.paidAmount,
        toPayQty: values.toPayQty,
        toPayAmount: values.toPayAmount,
        creditForQty: values.creditQty,
        creditForAmount: values.creditAmount,
      })
    );

    return res.status(200).json({
      success: true,
      message: "Dispatched memo report generated successfully",
      data: groupedData,
      totalPaid: totals.paid,
      totalToPay: totals.toPay,
      totalCredit: totals.credit,
      cityWiseDetails: cityWiseArray,
    });
  } catch (error) {
    console.error("Error in dispatchedMemoReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const parcelIncomingLuggagesReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

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

    const query = {
      companyId,            // ensure filtering by company
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 1,
    };

    if (fromCity && fromCity !== "all") query.fromCity = fromCity;
    if (toCity && toCity !== "all") query.toCity = toCity;
    if (pickUpBranch && pickUpBranch !== "all") query.pickUpBranch = pickUpBranch;
    if (dropBranch && dropBranch !== "all") query.dropBranch = dropBranch;

    const stockReport = await Booking.find(query)
      .select(
        "grnNo lrNumber fromCity toCity pickUpBranchname dropBranchname  deliveryEmployee senderName senderMobile vehicalNumber loadingDate bookingDate bookingType receiverName receiverMobile packages.packageType packages.quantity grandTotal"
      )
      .lean();

    if (stockReport.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No stock found for the given criteria",
      });
    }

    const totalGrandTotal = stockReport.reduce(
      (sum, record) => sum + (record.grandTotal || 0),
      0
    );

    const totalQuantity = stockReport.reduce((total, record) => {
      if (Array.isArray(record.packages)) {
        for (const pkg of record.packages) {
          total += pkg.quantity || 0;
        }
      }
      return total;
    }, 0);

    return res.status(200).json({
      success: true,
      data: stockReport,
      totalGrandTotal,
      totalQuantity,
    });
  } catch (error) {
    console.error("Error in parcelIncomingLuggagesReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const getBookingByGrnOrLrNumber = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { grnlrn } = req.body;

    if (!grnlrn || typeof grnlrn !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please provide grnlrn (grnNo or lrNumber) as a string in the request body",
      });
    }

    const orConditions = [];

    if (/^\d+$/.test(grnlrn)) {
      orConditions.push({ grnNo: parseInt(grnlrn, 10) });
    }
    orConditions.push({ lrNumber: grnlrn });

    const baseQuery = { companyId, $or: orConditions };

    const [booking, parcelLoading, parcelUnloading] = await Promise.all([
      Booking.findOne(baseQuery).lean(),
      ParcelLoading.findOne(baseQuery).lean(),
      ParcelUnloading.findOne(baseQuery).lean(),
    ]);

    return res.status(200).json({
      success: true,
      booking: booking || {},
      parcelLoading: parcelLoading || {},
      parcelUnloading: parcelUnloading || {},
    });
  } catch (error) {
    console.error("Error fetching data:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


// dashborad reports

const getAllBookingsAbove700 = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    // Find bookings with grandTotal > 700 and matching companyId
    const bookings = await Booking.find({
      companyId,
      grandTotal: { $gt: 700 },
    }).lean();

    if (bookings.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No bookings found with grandTotal above 700",
      });
    }

    return res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    console.error("Error fetching bookings above 700:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};


const salesSummaryByBranchWise = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required in request body.",
      });
    }

    // Validate and parse date (dd-mm-yyyy)
    const dateParts = date.split("-");
    if (dateParts.length !== 3) {
      return res.status(400).json({
        success: false,
        message: "Date must be in dd-mm-yyyy format.",
      });
    }
    const [day, month, year] = dateParts;
    const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    const bookings = await Booking.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          bookingDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: "$pickUpBranch",
          credit: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: "$bookingType" }, "credit"] },
                1,
                0,
              ],
            },
          },
          toPay: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: "$bookingType" }, "topay"] },
                1,
                0,
              ],
            },
          },
          paid: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: "$bookingType" }, "paid"] },
                1,
                0,
              ],
            },
          },
          CLR: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: "$bookingType" }, "clr"] },
                1,
                0,
              ],
            },
          },
          FOC: {
            $sum: {
              $cond: [
                { $eq: [{ $toLower: "$bookingType" }, "foc"] },
                1,
                0,
              ],
            },
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
            $ifNull: ["$branchDetails.name", "No branch"],
          },
        },
      },
    ]);

    if (bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No bookings found for the given date.",
        data: [],
      });
    }

    return res.status(200).json(bookings);
  } catch (err) {
    console.error("Error fetching branch-wise bookings:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};



const collectionSummaryReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    const { selectedDate } = req.body;

    if (!selectedDate) {
      return res.status(400).json({
        success: false,
        message: "selectedDate is required in request body",
      });
    }

    const startDate = moment(selectedDate, "DD-MM-YYYY")
      .startOf("day")
      .toDate();
    const endDate = moment(selectedDate, "DD-MM-YYYY")
      .endOf("day")
      .toDate();

    const summary = await Booking.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
          bookingDate: { $gte: startDate, $lte: endDate },
          bookingType: { $in: ["paid", "toPay"] }, // Only 'paid' and 'toPay'
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

    res.status(200).json({
      summary,
      totalBookingsForDay,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching booking summary" });
  }
};


const branchAccount = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    // Check for valid company ID
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { date } = req.body;

    // Base match object with company filter
    const matchStage = { companyId: new mongoose.Types.ObjectId(companyId) };

    // If date is provided, apply bookingDate filter
    if (date) {
      const [day, month, year] = date.split("-");

      // Validate date format
      if (!day || !month || !year) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format, expected DD-MM-YYYY",
        });
      }

      const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
      const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

      matchStage.bookingDate = { $gte: start, $lte: end };
    }

    // Aggregate branch-wise booking totals
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

    // Calculate overall total
    const totalAmount = result.reduce((sum, item) => sum + item.grandTotal, 0);

    res.status(200).json({
      branchwise: result,
      totalAmount,
    });
  } catch (error) {
    console.error("Error fetching branch totals:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching branch totals",
      error: error.message,
    });
  }
};


const acPartyAccount = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const { date } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required in request body.",
      });
    }

    const [day, month, year] = date.split("-");
    if (!day || !month || !year) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Expected DD-MM-YYYY.",
      });
    }

    const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    // Step 1: Get senderNames from Booking filtered by companyId & date
    const bookings = await Booking.aggregate([
      {
        $match: {
          companyId: new mongoose.Types.ObjectId(companyId),
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
      return res.status(404).json({
        success: true,
        message: "No bookings found for the given date.",
      });
    }

    // Step 2: Get valid senderNames from CFMaster (optionally filter by companyId)
    const cfMasters = await CFMaster.find(
      { companyId }, // Optional: only if CFMaster has companyId field
      { name: 1, _id: 0 }
    );
    const validSenderNames = cfMasters.map((cf) => cf.name);

    // Step 3: Filter bookings by valid senderNames from CFMaster
    const filtered = bookings.filter((b) =>
      validSenderNames.includes(b.senderName)
    );

    if (filtered.length === 0) {
      return res.status(404).json({
        success: true,
        message: "No matching senderName found in CFMaster for this date.",
      });
    }

    // Step 4: Calculate total amount
    const totalAmount = filtered.reduce(
      (sum, item) => sum + item.grandTotal,
      0
    );

    return res.status(200).json({
     parties: filtered,
      totalAmount,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Server error while processing party accounts.",
    });
  }
};

const statusWiseSummary = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Company ID missing",
      });
    }

    const result = await Booking.aggregate([
      {
        $match: { companyId: new mongoose.Types.ObjectId(companyId) },
      },
      {
        $group: {
          _id: "$pickUpBranchname",
          booking: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 0] }, 1, 0] },
          },
          loading: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 1] }, 1, 0] },
          },
          unloading: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 2] }, 1, 0] },
          },
          missing: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 3] }, 1, 0] },
          },
          delivered: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 4] }, 1, 0] },
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$bookingStatus", 5] }, 1, 0] },
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

    if (result.length === 0) {
      return res.status(404).json({
        success: true,
        message: "No booking statuses found.",
        branchwiseStatus: [],
      });
    }

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
    const companyId = req.user?.companyId;
    const branchId = req.user?.branchId;

    if (!companyId || !branchId) {
      return res.status(401).json({ message: "Unauthorized: Company ID or Branch ID missing" });
    }

    // Use current date
    const now = new Date();
    const startDate = new Date(now.setHours(0, 0, 0, 0));
    const endDate = new Date(now.setHours(23, 59, 59, 999));

    const matchStage = {
      companyId: new mongoose.Types.ObjectId(companyId),
      bookingDate: { $gte: startDate, $lte: endDate },
      pickUpBranch: branchId
    };

    const bookings = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$pickUpBranch",
          totalAmount: { $sum: "$grandTotal" },
          totalBookings: { $sum: 1 }
        }
      }
    ]);

    if (!bookings.length) {
      return res.status(404).json({ message: "No bookings found for today at this branch" });
    }

    return res.status(200).json({bookings });

  } catch (error) {
    console.error("Error in getTotalByBranchAndDate:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// const getTotalByBranchAndDate = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     console.log(req.user)
//     if (!companyId) {
//       return res.status(401).json({ message: "Unauthorized: Company ID missing" });
//     }

//     const { bookingDate, pickupBranch } = req.body;

//     if (!bookingDate || !pickupBranch) {
//       return res.status(400).json({ message: "bookingDate and pickupBranch are  required" });
//     }

//     // Convert to date object & build 00:00 to 23:59 UTC range
//     const date = new Date(bookingDate);
//     const startDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0));
//     const endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0));

//     const matchStage = {
//       companyId: new mongoose.Types.ObjectId(companyId),
//       bookingDate: {
//         $gte: startDate,
//         $lt: endDate,
//       },
//     };

//     if (pickupBranch) {
//       matchStage.pickUpBranch = req.user.branchId;
//     }

//     const bookings = await Booking.aggregate([
//       { $match: matchStage },
//       {
//         $group: {
//           _id: "$pickUpBranch",
//           total: { $sum: "$grandTotal" },
//           count: { $sum: 1 },
//         },
//       },
//     ]);

//     if (bookings.length === 0) {
//       return res.status(404).json({ message: "No bookings found for this date" });
//     }

//     return res.status(200).json({ bookings });
//   } catch (error) {
//     console.error("Error getting totals:", error);
//     return res.status(500).json({ message: "Server error" });
//   }
// };



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
  markParcelAsMissing,
//users data
  getUserByMobile,
  getAllUsers,
  getUsersBySearch,
  deleteUserByPhone,

  getCreditBookings,
  toDayBookings,
  // unReceivedBookings,

  receivedBooking,
  getAllDeliveries,
  cancelBooking,
  updateDelivery,
  // Reports

  parcelBookingReports,
  allParcelBookingReport,
  parcelReportSerialNo,
  parcelCancelReport,
  parcelBookingSummaryReport,
  parcelBookingMobileNumber,
  regularCustomerBooking,

  branchWiseCollectionReport,
  collectionforSummaryReport,
  collectionReportToPay,
  allCollectionReport,
bookingTypeWiseCollection,

  parcelBranchConsolidatedReport,
  consolidatedReportBranch,
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

  getTotalByBranchAndDate,
};
