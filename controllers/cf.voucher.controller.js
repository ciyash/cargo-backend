import CFVoucher from '../models/cf.voucher.generate.model.js' 
import CFMaster from '../models/cf.master.model.js '
import {Booking} from '../models/booking.model.js'


// const creditForVoucherGenerate = async (req, res) => {
//   try {
//       const { fromDate, toDate, senderName } = req.body;

//       if (!fromDate || !toDate) {
//           return res.status(400).json({ success: false, message: "Missing required query parameters" });
//       }

//       const from = new Date(fromDate);
//       const to = new Date(toDate);

//       if (isNaN(from) || isNaN(to)) {
//           return res.status(400).json({ success: false, message: "Invalid date format" });
//       }

//       // Include full 'toDate' day
//       to.setHours(23, 59, 59, 999);

//       // Build query with bookingTime instead of masterBookingDate
//       let query = {
//           bookingTime: { $gte: from, $lte: to }
//       };

//       if (senderName) {
//           query.senderName = { $regex: `^${senderName}$`, $options: "i" }; // Case-insensitive exact match
//       }

//       const bookings = await Booking.find(query)
//           .sort({ bookingTime: -1 })
//           .select("grnNo lrNumber senderName pickUpBranchname dropBranchname bookingStatus grandTotal bookingTime");

//       if (bookings.length === 0) {
//           return res.status(404).json({ message: "No bookings found" });
//       }

//       res.status(200).json(bookings);
//   } catch (error) {
//       res.status(500).json({ success: false, message: "Server Error", error: error.message });
//   }
// };


const creditForVoucherGenerate = async (req, res) => {
  try {
    const { fromDate, toDate, senderName } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: "Missing required query parameters" });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);
    to.setHours(23, 59, 59, 999); // Include full 'toDate' day

    if (isNaN(from) || isNaN(to)) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }

    // Build base query
    let bookingQuery = {
      bookingTime: { $gte: from, $lte: to }
    };

    // Add senderName filter if provided
    if (senderName) {
      bookingQuery.senderName = { $regex: `^${senderName}$`, $options: "i" };
    }

    const bookings = await Booking.find(bookingQuery)
      .sort({ bookingTime: -1 })
      .select("grnNo lrNumber senderName pickUpBranchname dropBranchname bookingStatus grandTotal bookingTime");

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found" });
    }

    // Get sender names from bookings
    const senderNames = [...new Set(bookings.map(b => b.senderName))];

    // Get matching names from CFMaster
    const matchedMasters = await CFMaster.find({
      name: { $in: senderNames }
    }).select("name");

    const validNames = matchedMasters.map(c => c.name);

    // Final filter: only bookings whose senderName is in CFMaster
    const filteredBookings = bookings.filter(b => validNames.includes(b.senderName));

    if (filteredBookings.length === 0) {
      return res.status(404).json({ message: "No matching bookings with valid company sender name" });
    }

    res.status(200).json(filteredBookings);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
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
        const { fromDate, toDate, grnNo, creditForAgent, fromBranch, toBranch, consignor, bookingStatus, charge } = req.body;

        const voucherNo = await generateVoucher();
        const newVoucher = new CFVoucher({
            voucherNo, fromDate, toDate, grnNo, creditForAgent, fromBranch, toBranch, consignor, bookingStatus, charge
        });

        await newVoucher.save();

        await CFMaster.updateOne(
            { grnNo: grnNo },
            { $set: { bookingStatus: 1 } }
        );

        res.status(201).json({ message: "CF Voucher created successfully", newVoucher });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ✅ Get All CFVouchers
 const getAllCFVouchers = async (req, res) => {
    try {
        const vouchers = await CFVoucher.find();
        res.status(200).json(vouchers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ✅ Get Single CFVoucher by ID
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

// ✅ Update CFVoucher
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

// ✅ Delete CFVoucher
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

const voucherDetails = async (req, res) => {
    try {
      const { fromDate, toDate, senderName } = req.body;
  
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message: "fromDate and toDate are required"
        });
      }
  
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
  
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
  
      // Build query
      let query = {
        bookingDate: {
          $gte: start,
          $lte: end
        }
      };
  
      if (senderName) {
        query.senderName = senderName;
      }
  
      const bookings = await Booking.find(query).select(
        "senderName grandTotal packages totalQuantity"
      );
  
      const result = bookings.map(b => ({
        senderName: b.senderName,
        grandTotal: b.grandTotal,
        numberOfPackages: b.packages.length,
        noOfParcels: b.totalQuantity
      }));
  
      res.status(200).json({
        success: true,
        totalRecords: bookings.length,
        data: result
      });
    } catch (error) {
      console.error("Error fetching voucher details:", error);
      res.status(500).json({
        success: false,
        message: "Server Error",
        error: error.message
      });
    }
  };

  const voucherDetailsPrint = async (req, res) => {
    try {
      const { fromDate, toDate, senderName } = req.body;
  
      if (!fromDate || !toDate) {
        return res.status(400).json({
          success: false,
          message: "fromDate and toDate are required"
        });
      }
  
      const start = new Date(fromDate);
      start.setHours(0, 0, 0, 0);
  
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
  
      // Build query
      let query = {
        bookingDate: {
          $gte: start,
          $lte: end
        }
      };
  
      if (senderName) {
        query.senderName = senderName;
      }
  
      const bookings = await Booking.find(query).select(
        "grnNo bookingDate fromCity toCity packages parcelGstAmount grandTotal"
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
          toCity: b.toCity,
          packageDetails: b.packages,
          totalPackages,
          parcelGstAmount: b.parcelGstAmount || 0,
          totalWeight,
          grandTotal: b.grandTotal || 0
        };
      });
  
      res.status(200).json({
        success: true,
        totalRecords: bookings.length,
        data: result,
        allGrandTotal
      });
  
    } catch (error) {
      console.error("Error fetching voucher details:", error);
      res.status(500).json({
        success: false,
        message: "Server Error",
        error: error.message
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
