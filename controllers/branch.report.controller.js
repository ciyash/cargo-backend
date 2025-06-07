import Branch from '../models/branch.model.js';
import { Booking } from '../models/booking.model.js';
import { Expense } from '../models/expensive.model.js';
import { BranchDailySnapshot } from '../models/expensive.model.js';

// Create daily snapshot for all branches of the user's company
const createDailyBranchSnapshot = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized: companyId missing' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Fetch branches only for the company
    const branches = await Branch.find({ companyId });

    for (const branch of branches) {
      const branchCode = branch.branchUniqueId;

      // Get last snapshot filtered by companyId and branchCode
      const lastSnapshot = await BranchDailySnapshot.findOne({ companyId, branchCode }).sort({ date: -1 });
      const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

      // Income for branch & company on this date
      const incomeResult = await Booking.aggregate([
        {
          $match: {
            companyId,
            pickUpBranch: branchCode,
            bookingDate: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: "$grandTotal" }
          }
        }
      ]);
      const income = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;

      // Expenses for branch & company on this date
      const expenseResult = await Expense.aggregate([
        {
          $match: {
            companyId,
            branchCode,
            date: { $gte: today, $lt: tomorrow }
          }
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" }
          }
        }
      ]);
      const expenses = expenseResult.length > 0 ? expenseResult[0].totalExpenses : 0;

      const closingBalance = openingBalance + income - expenses;

      // Save snapshot with companyId
      await BranchDailySnapshot.create({
        companyId,
        branchCode,
        date: today,
        openingBalance,
        income,
        expenses,
        closingBalance
      });

      console.log(`✅ Snapshot saved for branch ${branchCode}`);
    }

    res.status(201).json({ success: true, message: 'All branch snapshots created successfully' });
  } catch (error) {
    console.error("❌ Error creating branch snapshot:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get live snapshot for a single branch (company scoped)
const getLiveBranchSnapshot = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { branchCode } = req.params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const lastSnapshot = await BranchDailySnapshot.findOne({ companyId, branchCode }).sort({ date: -1 });
    const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

    const incomeResult = await Booking.aggregate([
      {
        $match: {
          companyId,
          pickUpBranch: branchCode,
          bookingDate: { $gte: today, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: "$grandTotal" }
        }
      }
    ]);
    const income = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;

    const expenseResult = await Expense.aggregate([
      {
        $match: {
          companyId,
          branchCode,
          date: { $gte: today, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$amount" }
        }
      }
    ]);
    const expenses = expenseResult.length > 0 ? expenseResult[0].totalExpenses : 0;

    const closingBalance = openingBalance + income - expenses;

    res.status(200).json({
      success: true,
      branchCode,
      date: today,
      time: now,
      openingBalance,
      income,
      expenses,
      closingBalance
    });
  } catch (error) {
    console.error("❌ Error getting live branch snapshot:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Live status for a branch (company scoped)
const getLiveStatus = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { branchCode } = req.params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const incomeResult = await Booking.aggregate([
      {
        $match: {
          companyId,
          pickUpBranch: branchCode,
          bookingDate: { $gte: today, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: "$grandTotal" }
        }
      }
    ]);
    const expenseResult = await Expense.aggregate([
      {
        $match: {
          companyId,
          branchCode,
          date: { $gte: today, $lte: now }
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: "$amount" }
        }
      }
    ]);

    const income = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;
    const expenses = expenseResult.length > 0 ? expenseResult[0].totalExpenses : 0;
    const liveBalance = income - expenses;

    res.status(200).json({
      success: true,
      branchCode,
      income,
      expenses,
      liveBalance
    });
  } catch (error) {
    console.error("❌ Failed to fetch live status", error);
    res.status(500).json({ success: false, message: 'Failed to fetch live status' });
  }
};

export default { createDailyBranchSnapshot, getLiveBranchSnapshot, getLiveStatus };
