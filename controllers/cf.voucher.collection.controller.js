import Vouchercollection from '../models/cf.voucher.collection.model.js'

import ParcelLoading from '../models/pracel.loading.model.js'
import {Booking} from '../models/booking.model.js';


const getVoucherDetails = async (req, res) => {
  try {
    const { fromDate, toDate, agent, voucherNo, voucherType } = req.body;

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

    // Build ParcelLoading query
    let parcelQuery = {
      loadingDate: {
        $gte: start,
        $lte: end
      }
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

    // Build Booking query
    const bookingQuery = {
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
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};


const createVoucher = async (req, res) => {
  try {
    const {
      fromDate,
      toDate,
      agent,
      voucherNo,
      voucherType,
      grnNo,
      user
    } = req.body;

    const newVoucher = new Vouchercollection({
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

// Get all vouchers
 const getAllVouchers = async (req, res) => {
  try {
    const vouchers = await Vouchercollection.find().sort({ createdAt: -1 });

    if (vouchers.length === 0) {
      return res.status(404).json({ success: false, message: "No vouchers found" });
    }

    res.status(200).json({ success: true, data: vouchers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get voucher by ID
 const getVoucherById = async (req, res) => {
  try {
    const voucher = await Vouchercollection.findById(req.params.id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }
    res.status(200).json({ success: true, data: voucher });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update voucher by ID
 const updateVoucher = async (req, res) => {
  try {
    const updated = await Vouchercollection.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Voucher not found" });
    }

    res.status(200).json({ success: true, message: "Voucher updated successfully", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete voucher by ID
 const deleteVoucher = async (req, res) => {
  try {
    const deleted = await Vouchercollection.findByIdAndDelete(req.params.id);
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
}
