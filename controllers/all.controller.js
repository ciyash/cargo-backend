import { User, Booking } from "../models/booking.model.js";
import CFMaster from "../models/cf.master.model.js";
import moment from "moment";

// subadmin access only

const parcelBookingMobileNumber = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      mobile,
      bookingType,
      bookingStatus,
      reportType,
    } = req.body;

    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized: User data missing" });
    }

    // ✅ Only allow subadmin
    if (req.user.role !== "subadmin") {
      return res
        .status(403)
        .json({ success: false, message: "Access denied: Subadmin only" });
    }

    if (!req.user.branchCity) {
      return res.status(400).json({
        success: false,
        message: "Branch city not found in user profile",
      });
    }

  
    let query = { fromCity: req.user.branchCity };

    // Date range filter
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(`${fromDate}T00:00:00.000Z`),
        $lte: new Date(`${toDate}T23:59:59.999Z`),
      };
    }

    // Mobile filter
    if (mobile && reportType) {
      if (reportType === "Sender") {
        query.senderMobile = mobile;
      } else if (reportType === "Receiver") {
        query.receiverMobile = mobile;
      } else if (reportType === "ALL") {
        query.$or = [{ senderMobile: mobile }, { receiverMobile: mobile }];
      }
    }

    // Optional filters
    if (bookingType) query.bookingType = bookingType;
    if (bookingStatus) query.bookingStatus = bookingStatus;

    const bookings = await Booking.find(query).select(
      "grnNo lrNumber bookingDate pickUpBranchname fromCity toCity senderName senderMobile receiverName receiverMobile deliveryDate bookingType totalQuantity grandTotal"
    );

    if (!bookings.length) {
      return res
        .status(200)
        .json({ success: true, message: "No customer bookings found." });
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
      data: bookings,
      allGrandTotal,
      allTotalQuantity,
    });
  } catch (error) {
    console.error("Error fetching parcel booking summary report:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const salesSummaryByBranchWise = async (req, res) => {
  try {
    const { date } = req.body;

    if (!req.user) {
      return res
        .status(401)
        .json({ message: "Unauthorized: User data missing" });
    }

    if (req.user.role !== "subadmin") {
      return res.status(403).json({ message: "Access denied: Subadmin only" });
    }

    if (!req.user.branchCity) {
      return res.status(400).json({
        message: "Subadmin's branch missing fromCity field.",
      });
    }

    if (!date) {
      return res
        .status(400)
        .json({ message: "Date is required in request body." });
    }

    // Parse date from dd-mm-yyyy
    const [day, month, year] = date.split("-");
    const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    const bookings = await Booking.aggregate([
      {
        $match: {
          bookingDate: { $gte: start, $lte: end },
          fromCity: req.user.branchCity, // ✅ Match only bookings from this city
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

    // Check for authenticated user
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: User data missing" });
    }

    // Allow only subadmins
    if (req.user.role !== "subadmin") {
      return res.status(403).json({ message: "Access denied: Subadmin only" });
    }

    // Check for branchCity in profile
    if (!req.user.branchCity) {
      return res.status(400).json({
        message: "Subadmin's branchCity not found in user profile",
      });
    }

    // Parse date using moment
    const startDate = moment(selectedDate, "DD-MM-YYYY").startOf("day").toDate();
    const endDate = moment(selectedDate, "DD-MM-YYYY").endOf("day").toDate();

    const summary = await Booking.aggregate([
      {
        $match: {
          bookingDate: { $gte: startDate, $lte: endDate },
          bookingType: { $in: ["paid", "toPay"] },
          fromCity: req.user.branchCity, // ✅ filter only from user's branch city
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

    // Ensure both booking types are included, even if zero
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
    console.error("Error in collectionSummaryReport:", error);
    res.status(500).json({ message: "Error fetching booking summary" });
  }
};

const branchAccount = async (req, res) => {
  try {
    const { date } = req.body;

    // Subadmin check
    if (!req.user || req.user.role !== "subadmin") {
      return res.status(403).json({ message: "Access denied: Subadmin only" });
    }

    // Ensure branchCity exists in profile
    if (!req.user.branchCity) {
      return res.status(400).json({
        message: "Subadmin's branchCity not found in user profile",
      });
    }

    const matchStage = {
      fromCity: req.user.branchCity, // ✅ filter by subadmin's city
    };

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
    console.error("Error in branchAccount:", error);
    res.status(500).json({ message: "Error fetching branch totals" });
  }
};

const acPartyAccount = async (req, res) => {
  try {
    const { date } = req.body;

    // Subadmin access check
    if (!req.user || req.user.role !== "subadmin") {
      return res.status(403).json({ message: "Access denied: Subadmin only" });
    }

    // Check if branchCity is available
    if (!req.user.branchCity) {
      return res
        .status(400)
        .json({ message: "Subadmin's branchCity not found in user profile." });
    }

    if (!date) {
      return res
        .status(400)
        .json({ message: "Date is required in request body." });
    }

    const [day, month, year] = date.split("-");
    const start = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
    const end = new Date(`${year}-${month}-${day}T23:59:59.999Z`);

    // Step 1: Get senderNames from Booking on date + fromCity filter
    const bookings = await Booking.aggregate([
      {
        $match: {
          bookingDate: { $gte: start, $lte: end },
          fromCity: req.user.branchCity, // ✅ Only subadmin's city
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

    // Step 2: Get valid senderNames from CFMaster
    const cfMasters = await CFMaster.find({}, { name: 1 });
    const validSenderNames = cfMasters.map((cf) => cf.name);

    // Step 3: Filter bookings with matching senderNames
    const filtered = bookings.filter((b) =>
      validSenderNames.includes(b.senderName)
    );

    if (filtered.length === 0) {
      return res.json({
        message: "No matching senderName found in CFMaster for this date.",
      });
    }

    // Step 4: Calculate total amount
    const totalAmount = filtered.reduce(
      (sum, item) => sum + item.grandTotal,
      0
    );

    res.json({
      parties: filtered,
      totalAmount,
    });
  } catch (error) {
    console.error("Error in acPartyAccount:", error);
    res.status(500).json({
      message: "Server error while processing party accounts.",
    });
  }
};

const statusWiseSummary = async (req, res) => {
  try {
    // ❌ Reject if not subadmin
    if (req.user.role !== "subadmin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only subadmins are allowed.",
      });
    }

    if (!req.user.branchCity) {
      return res.status(400).json({
        success: false,
        message: "Subadmin's branchCity not found in user profile.",
      });
    }

    const matchStage = {
      fromCity: req.user.branchCity, // ✅ Filter based on subadmin's city
    };

    const result = await Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$pickUpBranchname",
          booking: { $sum: { $cond: [{ $eq: ["$bookingStatus", 0] }, 1, 0] } },
          loading: { $sum: { $cond: [{ $eq: ["$bookingStatus", 1] }, 1, 0] } },
          unloading: { $sum: { $cond: [{ $eq: ["$bookingStatus", 2] }, 1, 0] } },
          missing: { $sum: { $cond: [{ $eq: ["$bookingStatus", 3] }, 1, 0] } },
          delivered: { $sum: { $cond: [{ $eq: ["$bookingStatus", 4] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$bookingStatus", 5] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          branch: "$_id", // 👈 This shows the pickUpBranchname
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
    console.error("Error in statusWiseSummary:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching booking status.",
    });
  }
};

// employee access only

const parcelBookingReports = async (req, res) => {
  try {
    let { fromDate, toDate, fromCity, toCity, bookingStatus } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    // ✅ Only allow 'employee' access
    if (req.user.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only employees are allowed to access this report.",
      });
    }

    const userBranchId = req.user.branchId;

    // Base query
    let query = {};

    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // ✅ Force employee's branch
    query.pickUpBranch = userBranchId;

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (bookingStatus) query.bookingStatus = Number(bookingStatus);

    const bookingTypes = ["paid", "credit", "toPay", "FOC", "CLR"];
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
    res.status(500).json({
      success: false,
      message: "Error fetching bookings",
      error: error.message,
    });
  }
};

const parcelReportSerialNo = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    // ✅ Only allow access to employees
    if (req.user.role !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only employees are allowed to access this report.",
      });
    }

    let query = {
      pickUpBranch: req.user.branchId, // ✅ Force branch based on logged-in employee
    };

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
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const parcelCancelReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, bookingType } = req.body;

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }
    
    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // ✅ Only allow access to employees
    if (userRole !== "employee") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only employees are allowed to access this report.",
      });
    }

    // Base query for cancelled bookings
    let query = {
      bookingStatus: 5, // Cancelled
      pickUpBranch: userBranchId, // Force branch-level data access
    };

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
      query.cancelDate = { $gte: start, $lte: end };
    }

    if (fromCity) {
      query.fromCity = { $regex: new RegExp(fromCity, "i") };
    }

    if (toCity) {
      query.toCity = { $regex: new RegExp(toCity, "i") };
    }

    if (bookingType) {
      query.bookingType = { $regex: new RegExp(bookingType, "i") };
    }

    const bookings = await Booking.find(query)
      .select(
        "bookingDate cancelDate fromCity toCity grnNo senderName receiverName totalQuantity grandTotal refundCharge refundAmount cancelByUser"
      )
      .sort({ bookingDate: 1 });

    let allTotalQuantity = 0;
    let allGrandTotal = 0;

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

const parcelBookingMobileNumberByEmployee = async (req, res) => {
  try {
    const { fromDate, toDate, mobile, bookingType, bookingStatus, reportType } = req.body;

    // 1. User Authentication Check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    // 2. Role-based Access Control
    const allowedRoles = ["employee", "admin", "manager"];
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: You are not authorized to access this resource.",
      });
    }

    // 3. Validate employee has branch info
    if (userRole === "employee" && !userBranchId) {
      return res.status(400).json({
        success: false,
        message: "Employee profile missing branch information.",
      });
    }

    // 4. Build MongoDB query
    const query = {};

    // Employee-level branch restriction
    if (userRole === "employee") {
      query.pickUpBranch = userBranchId;
    }

    // 5. Date filter
    if (fromDate && toDate) {
      const start = new Date(`${fromDate}T00:00:00.000Z`);
      const end = new Date(`${toDate}T23:59:59.999Z`);

      if (isNaN(start) || isNaN(end)) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format provided.",
        });
      }

      query.bookingDate = { $gte: start, $lte: end };
    }

    // 6. Mobile number filter
    if (mobile && reportType) {
      if (reportType === "Sender") {
        query.senderMobile = mobile;
      } else if (reportType === "Receiver") {
        query.receiverMobile = mobile;
      } else if (reportType === "ALL") {
        query.$or = [{ senderMobile: mobile }, { receiverMobile: mobile }];
      }
    }

    // 7. Optional filters
    if (bookingType) query.bookingType = bookingType;
    if (bookingStatus) query.bookingStatus = bookingStatus;

    // 8. Execute DB query
    const bookings = await Booking.find(query).select(
      "grnNo lrNumber bookingDate pickUpBranchname fromCity toCity senderName senderMobile receiverName receiverMobile deliveryDate bookingType totalQuantity grandTotal"
    );

    // 9. Return if no data found
    if (!bookings.length) {
      return res.status(200).json({
        success: true,
        message: "No customer bookings found.",
        data: [],
        allGrandTotal: 0,
        allTotalQuantity: 0,
      });
    }

    // 10. Calculate totals
    const allGrandTotal = bookings.reduce((sum, b) => sum + (b.grandTotal || 0), 0);
    const allTotalQuantity = bookings.reduce((sum, b) => sum + (b.totalQuantity || 0), 0);

    // 11. Send response
    return res.status(200).json({
      success: true,
      data: bookings,
      allGrandTotal,
      allTotalQuantity,
    });
  } catch (error) {
    console.error("Error fetching parcel booking summary report:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const parcelStatusDateDifferenceReport = async (req, res) => {
  try {
    const { startDate, endDate, fromCity, toCity } = req.body;

    // 1. Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the full end date

    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format",
      });
    }

    // 2. User check
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: User data missing",
      });
    }

    const userRole = req.user.role;
    const userBranchId = req.user.branchId;

    if (userRole === "employee" && !userBranchId) {
      return res.status(400).json({
        success: false,
        message: "Employee profile missing branch information.",
      });
    }

    // 3. Build query
    const query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 4, // Delivered status
    };

    // Employee branch access
    if (userRole === "employee") {
      query.pickUpBranch = userBranchId;
    }

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;

    // 4. Execute query
    const bookings = await Booking.find(query).select(
      "grnNo lrNumber bookingDate loadingDate unloadingDate deliveryDate deliveryEmployee fromCity toCity bookingStatus parcelGstAmount"
    );

    if (bookings.length === 0) {
      return res.status(404).json({
        success: true,
        message: "No delivered bookings found for the given criteria",
        data: [],
      });
    }

    // 5. Response
    return res.status(200).json({
      success: true,
      message: "Delivered parcel bookings report generated successfully",
      data: bookings,
    });
  } catch (error) {
    console.error("Error in parcelStatusDateDifferenceReport:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export default {  

  //subadmin access only

parcelBookingMobileNumber,
salesSummaryByBranchWise,
collectionSummaryReport,
branchAccount,
acPartyAccount,
statusWiseSummary,

//employee access only
parcelBookingReports,
parcelReportSerialNo,
parcelCancelReport,
parcelBookingMobileNumberByEmployee,
parcelStatusDateDifferenceReport,
}