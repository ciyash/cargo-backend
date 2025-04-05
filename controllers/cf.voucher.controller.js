import CFVoucher from '../models/cf.voucher.generate.model.js' 
import Masterbooking from '../models/master.booking.model.js'


const creditForVoucherGenerate = async (req, res) => {
    try {
        const { fromDate, toDate, senderName } = req.body;

        if (!fromDate || !toDate) {
            return res.status(400).json({ success: false, message: "Missing required query parameters" });
        }

        const from = new Date(fromDate);
        const to = new Date(toDate);
        if (isNaN(from) || isNaN(to)) {
            return res.status(400).json({ success: false, message: "Invalid date format" });
        }

        to.setHours(23, 59, 59, 999); // Include full day

        // Build query dynamically
        let query = {
            masterBookingDate: { $gte: from, $lte: to },
        };

        // If senderName is provided, add it to the query
        if (senderName) {
            query.senderName = { $regex: `^${senderName}$`, $options: "i" }; // Case-insensitive match
        }

        const masters = await Masterbooking.find(query)
            .sort({ masterBookingDate: -1 }) // Sort by newest first
            .select("grnNo senderName pickUpBranchname dropBranchname bookingStatus totalAmount masterBookingDate"); // Select required fields

        res.status(200).json(masters);
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

        await Masterbooking.updateOne(
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

export default {
creditForVoucherGenerate,
  createCFVoucher,
  getAllCFVouchers,
  getCFVoucherById,
  updateCFVoucher,
  deleteCFVoucher
}
