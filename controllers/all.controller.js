import { User, Booking } from "../models/booking.model.js";
import CFMaster from "../models/cf.master.model.js";
import ParcelLoading from "../models/pracel.loading.model.js";
import ParcelUnloading from "../models/parcel.unloading.model.js";
import Branch from "../models/branch.model.js";
import moment from "moment";

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



export default {  
parcelBookingMobileNumber,
salesSummaryByBranchWise,
collectionSummaryReport,
branchAccount,
acPartyAccount,
}