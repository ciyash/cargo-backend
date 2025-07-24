import CFVoucher from '../models/cf.voucher.generate.model.js';
import { Booking } from '../models/booking.model.js';


// Generate the next voucher number  
const generateVoucher = async () => {
  const lastVoucher = await CFVoucher.findOne().sort({ voucherNo: -1 });
  return lastVoucher ? lastVoucher.voucherNo + 1 : 100;
};


const creditForVoucherGenerate = async (req, res) => {
  try {
    const { fromDate, toDate, senderName } = req.body;
    const companyId = req.user?.companyId;
    const role = req.user?.role;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "Missing date filters" });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999);

    const query = {
      companyId,
      bookingDate: { $gte: from, $lte: to },
      agent: { $exists: true, $type: "string", $ne: "" },
      // bookingStatus: 0
      status: false 
    };

    // 🔐 Role-based filtering
    if (role === "employee") {
      query.pickUpBranch = req.user.branchId;
    } else if (role === "subadmin") {
      query.fromCity = req.user.branchCity;
    }
    // Admin = no additional branch/city filters

    if (senderName) {
      query.senderName = { $regex: `^${senderName}$`, $options: "i" };
    }

    const bookings = await Booking.find(query)
      .sort({ bookingDate: -1 })
      .select("grnNo lrNumber senderName pickUpBranchname dropBranchname bookingStatus grandTotal bookingDate agent");

    if (!bookings.length) {
      return res.status(404).json({ message: "No bookings found" });
    }

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error in creditForVoucherGenerate:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


// Create new voucher and update booking statuses
// const createCFVoucher = async (req, res) => {
//   try {
  
//     const companyId = req.user?.companyId;
//     if (!companyId) return res.status(401).json({ message: "Unauthorized" });

//     const {
//       grnNo,
//       lrNumber,
//       creditForAgent,
//       fromBranch,
//       toBranch,
//       consignor,
//       bookingStatus,
//       charge
//     } = req.body;

//     const voucherNo = await generateVoucher();

//     const newVoucher = new CFVoucher({
//       companyId,
//       voucherNo,
//       grnNo,
//       lrNumber,
//       creditForAgent,
//       fromBranch,
//       toBranch,
//       consignor,
//       bookingStatus,
//       charge
//     });

//     await newVoucher.save();

//     const grnList = Array.isArray(grnNo) ? grnNo.map(Number) : [Number(grnNo)];

//     await Booking.updateMany(
//       { grnNo: { $in: grnList }, companyId },
//       { $set: { bookingStatus: 1, status: true } }
//     );

//     res.status(201).json({ message: "CF Voucher created", newVoucher });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// };


const createCFVoucher = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ message: "Unauthorized" });

    const { grnNo } = req.body;

    if (!grnNo || grnNo.length === 0) {
      return res.status(400).json({ message: "GRNs are required" });
    }

    const grnList = Array.isArray(grnNo) ? grnNo.map(Number) : [Number(grnNo)];

    // Step 1: Fetch bookings for the GRNs
    const bookings = await Booking.find({ grnNo: { $in: grnList }, companyId });

    if (!bookings.length) {
      return res.status(404).json({ message: "No bookings found for the given GRNs" });
    }

    // Step 2: Group bookings by agent
    const groupedByAgent = {};

    for (const booking of bookings) {
      const agent = booking.agent;
      if (!groupedByAgent[agent]) {
        groupedByAgent[agent] = [];
      }
      groupedByAgent[agent].push(booking);
    }

    const createdVouchers = [];

    // Step 3: Loop each agent group and create voucher
    for (const agent in groupedByAgent) {
      const agentBookings = groupedByAgent[agent];

      const grns = agentBookings.map(b => b.grnNo);
      const lrs = agentBookings.map(b => b.lrNumber);
      const fromBranch = agentBookings[0].pickUpBranchname;
      const toBranch = agentBookings[0].dropBranchname;
      const consignor = agentBookings[0].senderName;

      const totalCharge = agentBookings.reduce((sum, b) => sum + (b.grandTotal || 0), 0);

      const voucherNo = await generateVoucher();

      const newVoucher = new CFVoucher({
        companyId,
        voucherNo,
        grnNo: grns,
        lrNumber: lrs,
        creditForAgent: agent,
        fromBranch,
        toBranch,
        consignor,
        bookingStatus: 1,
        charge: totalCharge
      });

      await newVoucher.save();

      // Update booking statuses
      await Booking.updateMany(
        { grnNo: { $in: grns }, companyId },
        { $set: {status: true } }
      );

      createdVouchers.push(newVoucher);
    }

    res.status(201).json({
      message: "CF Voucher(s) created successfully",
      count: createdVouchers.length,
      vouchers: createdVouchers
    });

  } catch (error) {
    console.error("Error creating CF Voucher:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// Get all vouchers for current company
const getAllCFVouchers = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const vouchers = await CFVoucher.find({ companyId });
    res.status(200).json(vouchers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get voucher by ID with company scope
const getCFVoucherById = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const voucher = await CFVoucher.findOne({ _id: id, companyId });
    if (!voucher) return res.status(404).json({ message: "CF Voucher not found" });
    res.status(200).json(voucher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update voucher
const updateCFVoucher = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const updatedVoucher = await CFVoucher.findOneAndUpdate(
      { _id: id, companyId },
      req.body,
      { new: true }
    );
    if (!updatedVoucher) return res.status(404).json({ message: "CF Voucher not found" });
    res.status(200).json({ message: "Updated successfully", updatedVoucher });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete voucher
const deleteCFVoucher = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;
    const deletedVoucher = await CFVoucher.findOneAndDelete({ _id: id, companyId });
    if (!deletedVoucher) return res.status(404).json({ message: "CF Voucher not found" });
    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Summary of vouchers by date range
const voucherDetails = async (req, res) => {
  try {
    const { fromDate, toDate, senderName } = req.body;
    const companyId = req.user?.companyId;
    if (!fromDate || !toDate || !companyId) {
      return res.status(400).json({ message: "Required parameters missing" });
    }

    const start = new Date(fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    const query = {
      companyId,
      generateDate: { $gte: start, $lte: end }
    };
    if (senderName) query.consignor = senderName;

    const vouchers = await CFVoucher.find(query)
      .select("grnNo voucherNo consignor")
      .sort({ generateDate: -1 });

    if (!vouchers.length) return res.status(404).json({ message: "No vouchers found" });

    const grnNos = vouchers.flatMap(v => v.grnNo);
    const bookings = await Booking.find({ grnNo: { $in: grnNos }, companyId }).select("grnNo packages grandTotal");

    const bookingMap = new Map();
    bookings.forEach(b => bookingMap.set(b.grnNo, b));

    let totalGrandTotal = 0;
    const data = vouchers.map(v => {
      let totalAmount = 0;
      let totalPackages = 0;
      v.grnNo.forEach(grn => {
        const b = bookingMap.get(grn);
        if (b) {
          totalAmount += b.grandTotal || 0;
          totalPackages += b.packages?.length || 0;
        }
      });
      totalGrandTotal += totalAmount;
      return {
        voucherNo: v.voucherNo,
        agentName: v.consignor,
        noOfParcel: totalPackages,
        amount: totalAmount
      };
    });

    res.status(200).json({ totalAmount: totalGrandTotal, data });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// const voucherDetailsPrint = async (req, res) => {
//   try {
//     const {voucherNo, creditForAgent } = req.body;
//     const companyId = req.user?.companyId;
//     const role = req.user?.role;

//       if (!voucherNo || !creditForAgent) {
//       return res.status(400).json({ message: "voucherNo and creditForAgent Missing fields" });
//     }


//     if (!companyId) {
//       return res.status(400).json({ message: "companyId missing" });
//     }

//     const query = {
//       senderName,
//       companyId
//     };

//     if (role === "employee") {
//       query.pickUpBranch = req.user.branchId;
//     } else if (role === "subadmin") {
//       query.fromCity = req.user.branchCity;
//     }
//     // admin → no additional filters

//     const bookings = await Booking.find(query).select(
//       "grnNo bookingDate agent senderName senderAddress fromCity toCity packages parcelGstAmount grandTotal"
//     );

//     let allGrandTotal = 0;
//     const data = bookings.map(b => {
//       const totalWeight = b.packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0);
//       const totalPackages = b.packages.length;
//       allGrandTotal += b.grandTotal || 0;

//       return {
//         grnNo: b.grnNo,
//         bookingDate: b.bookingDate,
//         fromCity: b.fromCity,
//         senderName: b.senderName,
//         agent: b.agent,
//         senderAddress: b.senderAddress,
//         toCity: b.toCity,
//         packageDetails: b.packages,
//         totalPackages,
//         parcelGstAmount: b.parcelGstAmount || 0,
//         totalWeight,
//         grandTotal: b.grandTotal || 0
//       };
//     });

//     const senderAddress = bookings.length > 0 ? bookings[0].senderAddress : "";

//     res.status(200).json({
//       success: true,
//       senderName,
//       senderAddress,
//       totalRecords: bookings.length,
//       data,
//       allGrandTotal
//     });

//   } catch (error) {
//     console.error("Error in voucherDetailsPrint:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// };

const voucherDetailsPrint = async (req, res) => {
  try {
    const { voucherNo, creditForAgent } = req.body;
    const companyId = req.user?.companyId;
    const role = req.user?.role;

    if (!voucherNo || !creditForAgent) {
      return res.status(400).json({ message: "voucherNo and creditForAgent are required" });
    }

    if (!companyId) {
      return res.status(400).json({ message: "companyId missing" });
    }

    // Step 1: Fetch voucher and extract GRNs
    const voucher = await CFVoucher.findOne({
      companyId,
      voucherNo,
      creditForAgent
    });

    if (!voucher) {
      return res.status(404).json({ message: "Voucher not found" });
    }

    const grnNos = voucher.grnNo || [];

    // Step 2: Prepare Booking query with role-based filters
    const query = {
      grnNo: { $in: grnNos },
      companyId
    };

    if (role === "employee") {
      query.pickUpBranch = req.user.branchId;
    } else if (role === "subadmin") {
      query.fromCity = req.user.branchCity;
    }

    // Step 3: Fetch bookings
    const bookings = await Booking.find(query).select(
      "grnNo bookingDate agent senderName senderAddress fromCity toCity packages parcelGstAmount grandTotal"
    );

    if (!bookings.length) {
      return res.status(404).json({ message: "No bookings found for this voucher" });
    }

    let allGrandTotal = 0;

    const data = bookings.map(b => {
      const totalWeight = b.packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0);
      const totalPackages = b.packages.length;
      allGrandTotal += b.grandTotal || 0;

      return {
        grnNo: b.grnNo,
        bookingDate: b.bookingDate,
        fromCity: b.fromCity,
        senderName: b.senderName,
        agent: b.agent,
        senderAddress: b.senderAddress,
        toCity: b.toCity,
        packageDetails: b.packages,
        totalPackages,
        parcelGstAmount: b.parcelGstAmount || 0,
        totalWeight,
        grandTotal: b.grandTotal || 0
      };
    });

    const senderName = bookings[0].senderName || "";
    const senderAddress = bookings[0].senderAddress || "";

    // Final response
    res.status(200).json({
      success: true,
      voucherNo,
      creditForAgent,
      senderName,
      senderAddress,
      totalRecords: bookings.length,
      data,
      allGrandTotal
    });

  } catch (error) {
    console.error("Error in voucherDetailsPrint:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export default {
  creditForVoucherGenerate,
  createCFVoucher,
  getAllCFVouchers,
  getCFVoucherById,
  updateCFVoucher,
  deleteCFVoucher,
  voucherDetails,
  voucherDetailsPrint,
};
