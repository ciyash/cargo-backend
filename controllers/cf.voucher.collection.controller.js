import Vouchercollection from '../models/cf.voucher.collection.model.js';
import ParcelLoading from '../models/pracel.loading.model.js';
import { Booking } from '../models/booking.model.js';

// Get voucher details with filters
const getVoucherDetails = async (req, res) => {
  try {
    const { fromDate, toDate, agent, voucherNo, voucherType } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: companyId missing" });
    }

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

    const parcelQuery = {
      companyId,
      loadingDate: { $gte: start, $lte: end }
    };
    if (voucherNo) parcelQuery.vocherNoUnique = voucherNo;

    const parcelLoadings = await ParcelLoading.find(parcelQuery);
    const grnNumbers = parcelLoadings.flatMap(p => p.grnNo).filter(Boolean);

    if (grnNumbers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No GRN numbers found for given filters",
        data: {
          voucherInfo: { fromDate, toDate, agent, voucherNo, voucherType },
          parcelLoadings,
          bookings: []
        }
      });
    }

    const bookingQuery = {
      companyId,
      grnNo: { $in: grnNumbers }
    };
    if (agent) bookingQuery.senderName = agent;
    if (voucherType) bookingQuery.bookingType = voucherType;

    const bookings = await Booking.find(bookingQuery)
      .select("grnNo senderName grandTotal bookingType");

    res.status(200).json({
      success: true,
      data: {
        voucherInfo: { fromDate, toDate, agent, voucherNo, voucherType },
        parcelLoadings,
        bookings
      }
    });
  } catch (error) {
    console.error("Error fetching voucher details:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Create new voucher
const createVoucher = async (req, res) => {
  try {
    const { fromDate, toDate, agent, voucherNo, voucherType, grnNo, user } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: companyId missing" });
    }

    const newVoucher = new Vouchercollection({
      companyId,
      fromDate,
      toDate,
      agent,
      voucherNo,
      voucherType,
      grnNo,
      user
    });

    const savedVoucher = await newVoucher.save();
    res.status(201).json({ success: true, message: "Voucher created successfully", data: savedVoucher });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Get all vouchers for current company
const getAllVouchers = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const vouchers = await Vouchercollection.find({ companyId }).sort({ createdAt: -1 });

    if (vouchers.length === 0) {
      return res.status(404).json({ success: false, message: "No vouchers found" });
    }

    res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get voucher by ID (company scoped)
const getVoucherById = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const voucher = await Vouchercollection.findOne({ _id: id, companyId });

    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    res.status(200).json({ success: true, data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update voucher by ID (company scoped)
const updateVoucher = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const updated = await Vouchercollection.findOneAndUpdate(
      { _id: id, companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    res.status(200).json({ success: true, message: "Voucher updated successfully", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete voucher by ID (company scoped)
const deleteVoucher = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    const { id } = req.params;

    const deleted = await Vouchercollection.findOneAndDelete({ _id: id, companyId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    res.status(200).json({ success: true, message: "Voucher deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  createVoucher,
  getAllVouchers,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  getVoucherDetails
};
