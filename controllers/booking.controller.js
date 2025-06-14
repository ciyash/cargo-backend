import { User, Booking ,Delivery} from "../models/booking.model.js";
import CFMaster from "../models/cf.master.model.js";
import Company from "../models/company.model.js";
import ParcelLoading from "../models/pracel.loading.model.js";
import ParcelUnloading from "../models/parcel.unloading.model.js";
import Branch from "../models/branch.model.js";
import moment from "moment";
import mongoose from "mongoose";

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

const checkMembership = async (user) => {
  if (!user?.companyId) {
    console.log("User does not have companyId");
    return false;
  }

  const company = await Company.findById(user.companyId).lean();
  if (!company) {
    console.log("Company not found");
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

    // --- Membership check added here ---
    const hasActiveMembership = await checkMembership(req.user);
    if (!hasActiveMembership) {
      return res.status(403).json({
        success: false,
        message: "Company membership expired or inactive. Booking not allowed.",
      });
    }
    // --- End membership check ---

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
      !grandTotal
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required booking fields",
      });
    }

    if (!senderName || !senderMobile || !receiverName || !receiverMobile) {
      return res.status(400).json({
        success: false,
        message: "Sender and receiver details are required",
      });
    }

    if (bookingType === "credit" && (!agent || agent.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "Agent is required when booking type is 'credit'",
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
      companyId: req.user.companyId,
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
    });

    const savedBooking = await booking.save();

   
if (savedBooking) {
  await Promise.all([
    (async () => {
      try {
        console.log("Checking sender...");
        const senderExists = await User.findOne({
          phone: senderMobile,
          companyId: req.user.companyId, // 🔹 Check with companyId
        });

        if (!senderExists) {
          console.log("Creating sender...");
          await User.create({
            name: senderName,
            phone: senderMobile,
            address: senderAddress,
            gst: senderGst,
            companyId: req.user.companyId, // 🔹 Include companyId in creation
          });
        }
      } catch (err) {
        console.error("Sender save error:", err.message);
      }
    })(),
    (async () => {
      try {
        console.log("Checking receiver...");
        const receiverExists = await User.findOne({
          phone: receiverMobile,
          companyId: req.user.companyId, // 🔹 Check with companyId
        });

        if (!receiverExists) {
          console.log("Creating receiver...");
          await User.create({
            name: receiverName,
            phone: receiverMobile,   
            address: receiverAddress,
            gst: receiverGst,
            companyId: req.user.companyId, // 🔹 Include companyId in creation
          });
        }
      } catch (err) {
        console.error("Receiver save error:", err.message);
      }
    })(),
  ]);
}


    
    return res.status(201).json({
      success: true,
      message: "Booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json({ error: error.message });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const companyId = req.user.companyId;
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
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: Company ID missing" });
    }

    const page = parseInt(req.query.page) || 1; // Default: Page 1
    const limit = parseInt(req.query.limit) || 10; // Default: 10 records per page
    const skip = (page - 1) * limit; // Calculate records to skip

    const totalBookings = await Booking.countDocuments({ companyId });
    const totalPages = Math.ceil(totalBookings / limit);

    const bookings = await Booking.find({ companyId })
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
    const update = req.body;

    const booking = await Booking.findOneAndUpdate(
      { _id: id, companyId }, // ensure the booking belongs to the company
      update,
      {
        new: true, // return the updated document
        runValidators: true, // enforce schema validation
      }
    );
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


const unReceivedBookings = async (req, res) => {
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
      fromBranch,
      toBranch,
    } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: "fromDate and toDate are required!",
      });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999); // Include the full toDate

    // Build dynamic query
    const query = {
      companyId,
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 2, // Status 2 indicates 'unreceived'
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (fromBranch) query.pickUpBranch = fromBranch;
    if (toBranch) query.dropBranch = toBranch;

    const bookings = await Booking.find(query);

    if (!bookings.length) {
      return res.status(404).json({
        success: false,
        message: "No unreceived bookings found in the selected filters.",
      });
    }

    return res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
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

    const { grnNo, receiverName, receiverMobile } = req.body;
    const deliveryEmployee = req.user?.name;
    const deliveryBranchName = req.user?.branchName || null;

    if (!grnNo) {
      return res.status(400).json({ message: "grnNo is required!" });
    }
    if (!deliveryEmployee) {
      return res.status(400).json({ message: "Delivery employee name is required!" });
    }
    if (!receiverName || !receiverMobile) {
      return res.status(400).json({ message: "Receiver name and mobile number are required!" });
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

    const deliveryDate = new Date();

    // ✅ Save in Delivery model
    const newDelivery = new Delivery({
      companyId,
      grnNo,
      receiverName,
      receiverMobile,
      deliveryDate,
      deliveryEmployee,
      deliveryBranchName,
    });
    await newDelivery.save();

    // ✅ Update Booking model
    booking.bookingStatus = 4;
    booking.deliveryDate = deliveryDate;
    booking.deliveryEmployee = deliveryEmployee;
    booking.deliveryBranchName = deliveryBranchName;
    booking.receiverName = receiverName;
    booking.receiverMobile = receiverMobile;

    await booking.save({ validateModifiedOnly: true });

    // ✅ Response kept same as you requested
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
      refundCharge,
      refundAmount,
      cancelDate,
      cancelByUser,
      cancelBranch,
      cancelCity,
    } = req.body;

    // Extra check (usually redundant if you have auth middleware)
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Find booking by grnNo and companyId for safety
    const booking = await Booking.findOne({ grnNo, companyId });
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

    // Proceed to cancel the booking
    booking.bookingStatus = 5;
    booking.cancelByUser = cancelByUser || req.user.name || "Unknown";
    booking.cancelBranch = cancelBranch || req.user.branch || null;
    booking.cancelCity = cancelCity || req.user.city || null;


    // booking.cancelDate = cancelDate ? new Date(cancelDate) : new Date();

    if (cancelDate && !isNaN(new Date(cancelDate))) {
  booking.cancelDate = new Date(cancelDate);
} else {
  booking.cancelDate = new Date();
}


    if (refundCharge !== undefined) {
      booking.refundCharge = refundCharge;
    }

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
    if (bookingStatus !== undefined) query.bookingStatus = Number(bookingStatus);
    if (vehicalNumber) query.vehicalNumber = { $regex: new RegExp(vehicalNumber, "i") };

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

    const userRole = req.user?.role;
    const userBranchId = req.user?.branchId;

    let query = { companyId }; // Include company filter

    // Date range
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // City filters (exact match, case-insensitive)
    if (fromCity) query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };

    // Branch filters
    if (userRole === "employee") {
      query.pickUpBranch = userBranchId;
    } else {
      if (pickUpBranch)
        query.pickUpBranch = { $regex: new RegExp(`^${pickUpBranch}$`, "i") };
    }

    if (dropBranch)
      query.dropBranch = { $regex: new RegExp(`^${dropBranch}$`, "i") };

    const bookings = await Booking.find(query).select(
      "bookingDate grnNo fromCity toCity pickUpBranch pickUpBranchname dropBranch totalPackages totalQuantity grandTotal"
    );

    if (bookings.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No customer bookings found.",
        data: [],
      });
    }

    // Summarize
    let totalBookings = bookings.length;
    let totalPackages = 0;
    let totalQuantity = 0;
    let totalAmount = 0;

    bookings.forEach((b) => {
      totalPackages += b.totalPackages || 0;
      totalQuantity += b.totalQuantity || 0;
      totalAmount += b.grandTotal || 0;
    });

    res.status(200).json({
      success: true,
      message: "Parcel booking summary report generated.",
      summary: {
        totalBookings,
        totalPackages,
        totalQuantity,
        totalAmount,
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
    } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    const query = [{ companyId }];

    // Restrict employee to their branch
    if (req.user.role === "employee") {
      query.push({ pickUpBranch: req.user.branchId });
    }

    // Date range
    if (fromDate && toDate) {
      query.push({
        bookingDate: {
          $gte: new Date(`${fromDate}T00:00:00.000Z`),
          $lte: new Date(`${toDate}T23:59:59.999Z`),
        },
      });
    }

    // Normalize and filter by mobile based on reportType
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

    // Optional filters
    if (bookingType) query.push({ bookingType });
    if (bookingStatus !== undefined) query.push({ bookingStatus });

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
    if (pickUpBranch) query.pickUpBranchname = pickUpBranch;
    if (dropBranch) query.dropBranchname = dropBranch;

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
      allTotalQuantity,
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

  

const parcelBranchConsolidatedReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: companyId missing" });
    }

    const matchStage = {
      bookingDate: { $ne: null },
      companyId: new mongoose.Types.ObjectId(companyId)
    };

    if (fromDate && toDate) {
      matchStage.bookingDate = {
        $gte: new Date(fromDate),
        $lte: new Date(toDate)
      };
    }
    if (fromCity)       matchStage.fromCity         = fromCity;
    if (pickUpBranch)   matchStage.pickUpBranchname = pickUpBranch;
    if (bookedBy)       matchStage.bookedBy         = bookedBy;

    const bookingData = await Booking.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "cities",
          localField: "fromCity",
          foreignField: "cityName",
          as: "fromCityData"
        }
      },
      { $unwind: { path: "$fromCityData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "cities",
          localField: "toCity",
          foreignField: "cityName",
          as: "toCityData"
        }
      },
      { $unwind: { path: "$toCityData", preserveNullAndEmptyArrays: true } },
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
      {
        $addFields: {
          igstAmount: {
            $cond: [{ $eq: ["$sameState", false] }, "$parcelGstAmount", 0]
          },
          cgstAmount: {
            $cond: [{ $eq: ["$sameState", true] }, { $divide: ["$parcelGstAmount", 2] }, 0]
          },
          sgstAmount: {
            $cond: [{ $eq: ["$sameState", true] }, { $divide: ["$parcelGstAmount", 2] }, 0]
          }
        }
      },
      {
        $group: {
          _id: {
            branchName:    "$pickUpBranchname",
            bookingStatus: "$bookingStatus",
            bookingType:   "$bookingType"
          },
          count:           { $sum: 1 },
          grandTotal:      { $sum: "$grandTotal" },
          parcelGstAmount: { $sum: "$parcelGstAmount" },
          igstAmount:      { $sum: "$igstAmount" },
          cgstAmount:      { $sum: "$cgstAmount" },
          sgstAmount:      { $sum: "$sgstAmount" }
        }
      }
    ]);

    const branchMap = {};
    const totals = {
      finalPaid: 0, finalToPay: 0, finalCredit: 0,
      finalFOC: 0, finalCLR: 0,
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
          paid: 0, toPay: 0, credit: 0, FOC: 0, CLR: 0,
          BookingTotal: 0, booking: 0,
          delivered: 0, cancelled: 0,
          grandTotal: 0, bookingTotalAmount: 0,
          deliveredTotalAmount: 0, cancelTotalAmount: 0,
          parcelGstAmount: 0, cancelAmount: 0,
          igstAmount: 0, cgstAmount: 0, sgstAmount: 0,
          deliveredAmountByType: {
            paid: 0, toPay: 0, credit: 0, FOC: 0, CLR: 0
          }
        };
      }

      const entry = branchMap[branchName];

      if (bookingType === "paid")    { entry.paid   += record.grandTotal; totals.finalPaid  += record.grandTotal; }
      if (bookingType === "toPay")   { entry.toPay  += record.grandTotal; totals.finalToPay += record.grandTotal; }
      if (bookingType === "credit")  { entry.credit += record.grandTotal; totals.finalCredit+= record.grandTotal; }
      if (bookingType === "FOC")     { entry.FOC    += record.grandTotal; totals.finalFOC   += record.grandTotal; }
      if (bookingType === "CLR")     { entry.CLR    += record.grandTotal; totals.finalCLR   += record.grandTotal; }

      entry.grandTotal       += record.grandTotal;
      entry.parcelGstAmount  += record.parcelGstAmount;
      entry.igstAmount       += record.igstAmount;
      entry.cgstAmount       += record.cgstAmount;
      entry.sgstAmount       += record.sgstAmount;

      totals.finalParcelGstAmount += record.parcelGstAmount;
      totals.totalIgst            += record.igstAmount;
      totals.totalCgst            += record.cgstAmount;
      totals.totalSgst            += record.sgstAmount;

      entry.BookingTotal += record.count;
      entry.booking      += record.count;
      totals.finalBookingTotal += record.grandTotal;

      if (bookingStatus === 4) {
        entry.delivered               += record.count;
        entry.deliveredTotalAmount   += record.grandTotal;
        totals.finalTotalDelivery    += record.grandTotal;

        if (entry.deliveredAmountByType[bookingType] !== undefined) {
          entry.deliveredAmountByType[bookingType] += record.grandTotal;
        }
      }

      if (bookingStatus === 5) {
        entry.cancelled           += record.count;
        entry.cancelTotalAmount   += record.grandTotal;
        entry.cancelAmount        += record.grandTotal;
        totals.finalTotalCancel   += record.grandTotal;
      }

      entry.bookingTotalAmount = entry.grandTotal;
    }

    Object.values(branchMap).forEach(entry => {
      entry.afterCalculate = entry.bookingTotalAmount - entry.cancelTotalAmount;
    });

    const finalNetBookingAmount = totals.finalBookingTotal - totals.finalTotalCancel;

    res.status(200).json({
      data: Object.values(branchMap),
      ...totals,
      finalNetBookingAmount
    });

  } catch (err) {
    console.error("Error in parcelBranchConsolidatedReport:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
};
   

// const parcelBranchConsolidatedReport = async (req, res) => {
//   try {
//     const companyId = req.user?.companyId;
//     if (!companyId) {
//       return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
//     }

//     const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;

//     // Always filter by companyId
//     const matchStage = {
//       bookingDate: { $ne: null },
//       companyId: companyId,  // <--- Important: companyId filter added here
//     };

//     if (fromDate && toDate) {
//       matchStage.bookingDate = {
//         $gte: new Date(fromDate),
//         $lte: new Date(toDate),
//       };
//     }
//     if (fromCity) matchStage.fromCity = fromCity;
//     if (pickUpBranch) matchStage.pickUpBranchname = pickUpBranch;
//     if (bookedBy) matchStage.bookedBy = bookedBy;

//     const bookingData = await Booking.aggregate([
//       { $match: matchStage },
//       {
//         $lookup: {
//           from: "cities",
//           localField: "fromCity",
//           foreignField: "cityName",
//           as: "fromCityData",
//         },
//       },
//       { $unwind: { path: "$fromCityData", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "cities",
//           localField: "toCity",
//           foreignField: "cityName",
//           as: "toCityData",
//         },
//       },
//       { $unwind: { path: "$toCityData", preserveNullAndEmptyArrays: true } },
//       {
//         $addFields: {
//           sameState: {
//             $eq: [
//               { $toLower: "$fromCityData.state" },
//               { $toLower: "$toCityData.state" },
//             ],
//           },
//         },
//       },
//       {
//         $addFields: {
//           igstAmount: {
//             $cond: [{ $eq: ["$sameState", false] }, "$parcelGstAmount", 0],
//           },
//           cgstAmount: {
//             $cond: [
//               { $eq: ["$sameState", true] },
//               { $divide: ["$parcelGstAmount", 2] },
//               0,
//             ],
//           },
//           sgstAmount: {
//             $cond: [
//               { $eq: ["$sameState", true] },
//               { $divide: ["$parcelGstAmount", 2] },
//               0,
//             ],
//           },
//         },
//       },
//       {
//         $group: {
//           _id: {
//             branchName: "$pickUpBranchname",
//             bookingStatus: "$bookingStatus",
//             bookingType: "$bookingType",
//           },
//           count: { $sum: 1 },
//           grandTotal: { $sum: "$grandTotal" },
//           parcelGstAmount: { $sum: "$parcelGstAmount" },
//           igstAmount: { $sum: "$igstAmount" },
//           cgstAmount: { $sum: "$cgstAmount" },
//           sgstAmount: { $sum: "$sgstAmount" },
//         },
//       },
//     ]);

//     const branchMap = {};
//     const totals = {
//       finalPaid: 0,
//       finalToPay: 0,
//       finalCredit: 0,
//       finalFOC: 0,
//       finalCLR: 0,
//       finalBookingTotal: 0,
//       finalTotalDelivery: 0,
//       finalTotalCancel: 0,
//       finalParcelGstAmount: 0,
//       totalIgst: 0,
//       totalCgst: 0,
//       totalSgst: 0,
//     };

//     for (const record of bookingData) {
//       const { branchName, bookingStatus, bookingType } = record._id;

//       if (!branchMap[branchName]) {
//         branchMap[branchName] = {
//           branchName,
//           paid: 0,
//           toPay: 0,
//           credit: 0,
//           FOC: 0,
//           CLR: 0,
//           BookingTotal: 0,
//           booking: 0,
//           delivered: 0,
//           cancelled: 0,
//           grandTotal: 0,
//           bookingTotalAmount: 0,
//           deliveredTotalAmount: 0,
//           cancelTotalAmount: 0,
//           parcelGstAmount: 0,
//           cancelAmount: 0,
//           igstAmount: 0,
//           cgstAmount: 0,
//           sgstAmount: 0,
//           deliveredAmountByType: {
//             paid: 0,
//             toPay: 0,
//             credit: 0,
//             FOC: 0,
//             CLR: 0,
//           },
//         };
//       }

//       const entry = branchMap[branchName];

//       // Booking Type Sums
//       switch (bookingType) {
//         case "paid":
//           entry.paid += record.grandTotal;
//           totals.finalPaid += record.grandTotal;
//           break;
//         case "toPay":
//           entry.toPay += record.grandTotal;
//           totals.finalToPay += record.grandTotal;
//           break;
//         case "credit":
//           entry.credit += record.grandTotal;
//           totals.finalCredit += record.grandTotal;
//           break;
//         case "FOC":
//           entry.FOC += record.grandTotal;
//           totals.finalFOC += record.grandTotal;
//           break;
//         case "CLR":
//           entry.CLR += record.grandTotal;
//           totals.finalCLR += record.grandTotal;
//           break;
//       }

//       // Common Aggregations
//       entry.grandTotal += record.grandTotal;
//       entry.parcelGstAmount += record.parcelGstAmount;
//       entry.igstAmount += record.igstAmount;
//       entry.cgstAmount += record.cgstAmount;
//       entry.sgstAmount += record.sgstAmount;

//       totals.finalParcelGstAmount += record.parcelGstAmount;
//       totals.totalIgst += record.igstAmount;
//       totals.totalCgst += record.cgstAmount;
//       totals.totalSgst += record.sgstAmount;

//       entry.BookingTotal += record.count;
//       entry.booking += record.count;
//       totals.finalBookingTotal += record.grandTotal;

//       // Delivered Bookings (status code 4)
//       if (bookingStatus === 4) {
//         entry.delivered += record.count;
//         entry.deliveredTotalAmount += record.grandTotal;
//         totals.finalTotalDelivery += record.grandTotal;

//         if (entry.deliveredAmountByType[bookingType] !== undefined) {
//           entry.deliveredAmountByType[bookingType] += record.grandTotal;
//         }
//       }

//       // Cancelled Bookings (status code 5)
//       if (bookingStatus === 5) {
//         entry.cancelled += record.count;
//         entry.cancelTotalAmount += record.grandTotal;
//         entry.cancelAmount += record.grandTotal;
//         totals.finalTotalCancel += record.grandTotal;
//       }

//       entry.bookingTotalAmount = entry.grandTotal;
//     }

//     // Add afterCalculate field per branch
//     Object.values(branchMap).forEach((entry) => {
//       entry.afterCalculate = entry.bookingTotalAmount - entry.cancelTotalAmount;
//     });

//     // Calculate net booking total (excluding cancelled)
//     const finalNetBookingAmount = totals.finalBookingTotal - totals.finalTotalCancel;

//     res.status(200).json({
//       data: Object.values(branchMap),
//       ...totals,
//       finalNetBookingAmount,
//     });
//   } catch (err) {
//     console.error("Error in parcelBranchConsolidatedReport:", err);
//     res.status(500).json({ message: "Server Error", error: err.message });
//   }
// };


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




const pendingDeliveryLuggageReport = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Company ID missing" });
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
      return res.status(400).json({ success: false, message: "fromDate and toDate are required" });
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
        "grnNo unloadingDate fromCity toCity senderName senderMobile receiverName bookingType packages bookingDate"
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

      // Calculate days difference from bookingDate to today
      const dayDiff = bookingDate
        ? Math.floor((new Date() - new Date(bookingDate)) / (1000 * 60 * 60 * 24))
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

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    // Build query including companyId and bookingStatus = 4 (delivered)
    let query = {
      companyId,
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 4,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    const stockReport = await Booking.find(query)
      .select(
        "grnNo lrNumber deliveryEmployee totalCharge fromCity pickUpBranchname senderName senderMobile bookingType receiverName packages.packageType packages.quantity packages.totalPrice parcelGstAmount totalPackages serviceCharge hamaliCharge doorDeliveryCharge doorPickupCharge"
      )
      .lean();

    if (!stockReport.length) {
      return res.status(404).json({
        success: false,
        message: "No stock found for the given criteria",
      });
    }

    let totalPackages = 0;
    let totalFreight = 0;
    let totalGST = 0;
    let totalOtherCharges = 0;
    let totalNetAmount = 0;

    const bookingTypeSummary = {
      Paid: { freight: 0, gst: 0, otherCharges: 0, netAmount: 0 },
      ToPay: { freight: 0, gst: 0, otherCharges: 0, netAmount: 0 },
    };

    const updatedDeliveries = stockReport.map((delivery, index) => {
      const {
        grnNo,
        lrNumber,
        deliveryEmployee,
        totalCharge = 0,
        fromCity,
        pickUpBranchname,
        senderName,
        senderMobile,
        bookingType,
        receiverName,
        packages = [],
        parcelGstAmount = 0,
        totalPackages: packageCount = 0,
        serviceCharge = 0,
        hamaliCharge = 0,
        doorDeliveryCharge = 0,
        doorPickupCharge = 0,
      } = delivery;

      const otherCharges = serviceCharge + hamaliCharge + doorDeliveryCharge + doorPickupCharge;
      const netAmount = totalCharge + parcelGstAmount + otherCharges;

      // Normalize bookingType to "Paid" or "ToPay"
      const normalizedType = (bookingType || "").toLowerCase() === "paid" ? "Paid" : "ToPay";

      totalFreight += totalCharge;
      totalGST += parcelGstAmount;
      totalOtherCharges += otherCharges;
      totalNetAmount += netAmount;
      totalPackages += packageCount;

      if (bookingTypeSummary[normalizedType]) {
        bookingTypeSummary[normalizedType].freight += totalCharge;
        bookingTypeSummary[normalizedType].gst += parcelGstAmount;
        bookingTypeSummary[normalizedType].otherCharges += otherCharges;
        bookingTypeSummary[normalizedType].netAmount += netAmount;
      }

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
        Pkgs: packageCount,
        Amount: totalCharge,
      };
    });

    return res.status(200).json({
      success: true,
      message: "Delivered stock report generated successfully",
      data: {
        deliveries: updatedDeliveries,
        summary: {
          totalPackages,
          totalFreight,
          totalGST,
          totalOtherCharges,
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
        "grnNo lrNumber deliveryEmployee senderName senderMobile vehicalNumber loadingDate bookingDate bookingType receiverName receiverMobile packages.packageType packages.quantity grandTotal"
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
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    const { bookingDate, pickupBranch } = req.body;

    if (!bookingDate) {
      return res.status(400).json({ message: "bookingDate is required" });
    }

    // Assuming bookingDate input format is "YYYY-MM-DD" or ISO string
    const startDate = new Date(bookingDate);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    const matchStage = {
      companyId,
      bookingDate: {
        $gte: startDate,
        $lt: endDate,
      },
    };

    if (pickupBranch) {
      matchStage.pickUpBranch = pickupBranch;
    }

    const bookings = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$pickUpBranch",
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found for this date" });
    }

    return res.status(200).json({ bookings });
  } catch (error) {
    console.error("Error getting totals:", error);
    return res.status(500).json({ message: "Server error" });
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
  markParcelAsMissing,
  getUserByMobile,
  getAllUsers,
  getUsersBySearch,
  getCreditBookings,
  toDayBookings,
  unReceivedBookings,

  receivedBooking,
  getAllDeliveries,
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

  getTotalByBranchAndDate,
};
