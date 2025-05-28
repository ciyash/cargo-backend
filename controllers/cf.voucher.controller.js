import CFVoucher from '../models/cf.voucher.generate.model.js' 
import CFMaster from '../models/cf.master.model.js '
import {Booking} from '../models/booking.model.js'

// const creditForVoucherGenerate = async (req, res) => {
//   try {
//     const { fromDate, toDate, senderName } = req.body;

//     // Step 1: Validate dates
//     if (!fromDate || !toDate) {
//       return res.status(400).json({ success: false, message: "Missing required query parameters" });
//     }

//     const from = new Date(fromDate);
//     const to = new Date(toDate);
//     to.setHours(23, 59, 59, 999); // Full day

//     if (isNaN(from) || isNaN(to)) {
//       return res.status(400).json({ success: false, message: "Invalid date format" });
//     }

//     // Step 2: Get sender names from CFMaster
//     let cfMasterQuery = {};
//     if (senderName) {
//       cfMasterQuery.name = { $regex: `^${senderName}$`, $options: "i" };
//     }

//     const matchedMasters = await CFMaster.find(cfMasterQuery).select("name");

//     if (!matchedMasters.length) {
//       return res.status(404).json({ message: "No matching sender names found in CFMaster" });
//     }

//     const validSenderNames = matchedMasters.map(master => master.name);

//     // Step 3: Booking query with senderName IN validSenderNames
//     const bookingQuery = {
//       bookingTime: { $gte: from, $lte: to },
//       senderName: { $in: validSenderNames }
//     };

//     const bookings = await Booking.find(bookingQuery)
//       .sort({ bookingTime: -1 })
//       .select("grnNo lrNumber senderName pickUpBranchname dropBranchname bookingStatus grandTotal bookingTime");

//     if (!bookings.length) {
//       return res.status(404).json({ message: "No bookings found for given date and sender match" });
//     }

//     res.status(200).json(bookings);
//   } catch (error) {
//     res.status(500).json({ success: false, message: "Server Error", error: error.message });
//   }
// };


const creditForVoucherGenerate = async (req, res) => {
  try {
    const { fromDate, toDate, senderName } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "Missing required date parameters" });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999); // include entire 'toDate'

    if (isNaN(from) || isNaN(to)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    const query = {
      bookingDate: { $gte: from, $lte: to }, // ✅ corrected field
      agent: { $exists: true, $type: "string", $ne: "" }, // ✅ only if agent length > 0
      bookingStatus: 0
    };

    if (senderName) {
      query.senderName = { $regex: `^${senderName}$`, $options: "i" };
    }

    const bookings = await Booking.find(query)
      .sort({ bookingDate: -1 })
      .select("grnNo lrNumber senderName pickUpBranchname dropBranchname bookingStatus grandTotal bookingDate agent");

    if (!bookings.length) {
      return res.status(404).json({ message: "No company bookings found for given criteria" });
    }

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};


const generateVoucher = async () => {

    const lastVoucher = await CFVoucher.findOne().sort({ voucherNo: -1 });

    if (!lastVoucher) {
        return 100; // Start from 100 if no vouchers exist
    }

    return lastVoucher.voucherNo + 1; // Increment the last voucher number
};


const createCFVoucher = async (req, res) => {
  try {
    const {
      grnNo,
      lrNumber,
      creditForAgent,
      fromBranch,
      toBranch,
      consignor,
      bookingStatus,
      charge
    } = req.body;

    const voucherNo = await generateVoucher();

    const newVoucher = new CFVoucher({
      voucherNo,
      grnNo,
      lrNumber,
      creditForAgent,
      fromBranch,
      toBranch,
      consignor,
      bookingStatus,
      charge
    });

    await newVoucher.save();

    const grnList = Array.isArray(grnNo)
      ? grnNo.map((no) => Number(no))
      : [Number(grnNo)];


    const foundBookings = await Booking.find({ grnNo: { $in: grnList } });
    

    const updateResult = await Booking.updateMany(
      { grnNo: { $in: grnList } },
      { $set: { bookingStatus: 1 } }
    );

    

    res.status(201).json({ message: "CF Voucher created successfully", newVoucher });

  } catch (error) {
    console.error("Error in createCFVoucher:", error);
    res.status(500).json({ error: error.message });
  }
};




 const getAllCFVouchers = async (req, res) => {
    try {
        const vouchers = await CFVoucher.find();
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


 const getCFVoucherById = async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await CFVoucher.findById(id);

        if (!voucher) {
            return res.status(404).json({ message: "CF Voucher not found" });
        }

        res.status(200).json(voucher);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};      
   

 const updateCFVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedVoucher = await CFVoucher.findByIdAndUpdate(id, req.body, { new: true });

        if (!updatedVoucher) {
            return res.status(404).json({ message: "CF Voucher not found" });
        }

        res.status(200).json({ message: "CF Voucher updated successfully", updatedVoucher });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

 const deleteCFVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedVoucher = await CFVoucher.findByIdAndDelete(id);

        if (!deletedVoucher) {
            return res.status(404).json({ message: "CF Voucher not found" });
        }

        res.status(200).json({ message: "CF Voucher deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// const voucherDetails = async (req, res) => {
//   try {
//     const { fromDate, toDate, senderName } = req.body;

//     // Validate input
//     if (!fromDate || !toDate) {
//       return res.status(400).json({
//         success: false,
//         message: "fromDate and toDate are required",
//       });
//     }

//     const start = new Date(fromDate);
//     start.setHours(0, 0, 0, 0);

//     const end = new Date(toDate);
//     end.setHours(23, 59, 59, 999);

//     // Build CFVoucher query
//     const cfVoucherQuery = {
//       generateDate: { $gte: start, $lte: end },
//     };
//     if (senderName) {
//       cfVoucherQuery.consignor = senderName;
//     }

//     // Fetch vouchers
//     const cfVouchers = await CFVoucher
//       .find(cfVoucherQuery)
//       .select("grnNo voucherNo")
//       .sort({ generateDate: -1 });

//     if (!cfVouchers.length) {
//       return res.status(404).json({
//         success: false,
//         message: "No vouchers found for given criteria",
//       });
//     }

//     // Flatten grnNos from vouchers
//     const grnNos = cfVouchers.flatMap(v => v.grnNo);

//     // Get corresponding bookings
//     const bookings = await Booking
//       .find({ grnNo: { $in: grnNos } })
//       .select("grnNo bookingDate fromCity toCity senderName packages grandTotal");

//     // Create a map for quick lookup
//     const bookingMap = new Map();
//     bookings.forEach(b => bookingMap.set(b.grnNo, b));

//     let totalGrandTotal = 0;

//     // Merge vouchers with booking info
//     const result = cfVouchers.map(voucher => {
//       const matchedGrns = voucher.grnNo.map(grn => {
//         const booking = bookingMap.get(grn);
//         const grandTotal = booking?.grandTotal || 0;
//         totalGrandTotal += grandTotal;

//         return {
//           grnNo: grn,
//           senderName: booking?.senderName || null,
//           grandTotal: grandTotal,
//           numberOfPackages: booking?.packages?.length || 0,
//           packages: booking?.packages || [],
//           bookingDate: booking?.bookingDate || null,
//           fromCity: booking?.fromCity || null,
//           toCity: booking?.toCity || null,
//         };
//       });

//       return {
//         voucherNo: voucher.voucherNo,
//         grns: matchedGrns,
//       };
//     });

//     return res.status(200).json({
//       totalGrandTotal,
//       data: result,
//     });

//   } catch (error) {
//     return res.status(500).json({
//       success: false,
//       message: "Server Error",
//       error: error.message,
//     });
//   }
// };


const voucherDetails = async (req, res) => {
  try {
    const { fromDate, toDate, senderName } = req.body;

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

    const cfVoucherQuery = {
      generateDate: { $gte: start, $lte: end },
    };

    if (senderName) {
      cfVoucherQuery.consignor = senderName;
    }

    const cfVouchers = await CFVoucher
      .find(cfVoucherQuery)
      .select("grnNo voucherNo consignor")
      .sort({ generateDate: -1 });

    if (!cfVouchers.length) {
      return res.status(404).json({
        success: false,
        message: "No vouchers found for given criteria",
      });
    }

    const grnNos = cfVouchers.flatMap(v => v.grnNo);

    const bookings = await Booking
      .find({ grnNo: { $in: grnNos } })
      .select("grnNo packages grandTotal");

    const bookingMap = new Map();
    bookings.forEach(b => bookingMap.set(b.grnNo, b));

    let totalGrandTotal = 0;

    const result = cfVouchers.map(voucher => {
      let totalAmount = 0;
      let totalPackages = 0;

      voucher.grnNo.forEach(grn => {
        const booking = bookingMap.get(grn);
        if (booking) {
          totalAmount += booking.grandTotal || 0;
          totalPackages += booking.packages?.length || 0;
        }
      });

      totalGrandTotal += totalAmount;

      return {
        voucherNo: voucher.voucherNo,
        agentName: voucher.consignor,
        noOfParcel: totalPackages,
        amount: totalAmount
      };
    });

    return res.status(200).json({
      totalAmount: totalGrandTotal,
      data: result
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message
    });
  }
};


// const voucherDetailsPrint = async (req, res) => {
//   try {
//     const { senderName } = req.body;

//     // Validate required field
//     if (!senderName) {
//       return res.status(400).json({
//         success: false,
//         message: "senderName is required"
//       });
//     }

//     const query = { senderName };

//     const bookings = await Booking.find(query).select(
//       "grnNo bookingDate agent senderName senderAddress fromCity toCity packages parcelGstAmount grandTotal"
//     );

//     let allGrandTotal = 0;

//     const result = bookings.map(b => {
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

//     res.status(200).json({
//       success: true,
//       totalRecords: bookings.length,
//       data: result,
//       allGrandTotal
//     });

//   } catch (error) {
//     console.error("Error fetching voucher details:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server Error",
//       error: error.message
//     });
//   }
// };


const voucherDetailsPrint = async (req, res) => {
  try {
    const { senderName } = req.body;

    // Validate required field
    if (!senderName) {
      return res.status(400).json({
        success: false,
        message: "senderName is required",
        senderName
      });
    }

    const query = { senderName };

    const bookings = await Booking.find(query).select(
      "grnNo bookingDate agent senderName senderAddress fromCity toCity packages parcelGstAmount grandTotal"
    );

    let allGrandTotal = 0;

    const result = bookings.map(b => {
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

    // Get senderAddress from the first record (if available)
    const senderAddress = bookings.length > 0 ? bookings[0].senderAddress : "";

    res.status(200).json({
      success: true,
      senderName,
      senderAddress,
      totalRecords: bookings.length,
      data: result,
      allGrandTotal
    });

  } catch (error) {
    console.error("Error fetching voucher details:", error);
    res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
      senderName: req.body?.senderName || null
    });
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
  voucherDetailsPrint
}
