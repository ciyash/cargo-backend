import Branch      from '../models/branch.model.js';
import { Booking } from '../models/booking.model.js';
import { Expense } from '../models/expensive.model.js';
import {BranchDailySnapshot} from '../models/expensive.model.js'


const createDailyBranchSnapshot = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const branches = await Branch.find({});

    for (const branch of branches) {
      const branchCode = branch.branchUniqueId;

      // గత snapshot తీసుకోండి
      const lastSnapshot = await BranchDailySnapshot.findOne({ branchCode }).sort({ date: -1 });
      const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

      // ఆ రోజు ఆదాయం
      const incomeResult = await Booking.aggregate([
        {
          $match: {
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

      // ఆ రోజు ఖర్చులు
      const expenseResult = await Expense.aggregate([
        {
          $match: {
            branchCode: branchCode,
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

      // Snapshot save చెయ్యడం
      const snapshot = await BranchDailySnapshot.create({
        branchCode,
        date: today,
        openingBalance,
        income,
        expenses,
        closingBalance
      });

      console.log(`✅ Snapshot saved for branch ${branchCode}`, snapshot);
    }

    console.log("🎉 All branch snapshots created successfully.");
  } catch (error) {
    console.error("❌ Error creating branch snapshot:", error);
  }
};

const getLiveBranchSnapshot = async (branchCode) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();

    // Last snapshot taken
    const lastSnapshot = await BranchDailySnapshot.findOne({ branchCode }).sort({ date: -1 });
    const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

    // Income so far today
    const incomeResult = await Booking.aggregate([
      {
        $match: {
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

    // Expenses so far today
    const expenseResult = await Expense.aggregate([
      {
        $match: {
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

    // Closing balance till now
    const closingBalance = openingBalance + income - expenses;

    return {
      branchCode,
      date: today,
      time: now,
      openingBalance,
      income,
      expenses,
      closingBalance
    };

  } catch (error) {
    console.error("❌ Error getting live branch snapshot:", error);
    throw error;
  }
};

 const getLiveStatus = async (req, res) => {
  try {
    const branchCode = req.params.branchCode;

    console.log("📍 Requested branchCode:", branchCode);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();

    const incomeResult = await Booking.aggregate([
      {
        $match: {
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

    console.log("💰 Income result:", incomeResult);

    const expenseResult = await Expense.aggregate([
      {
        $match: {
          branchCode: branchCode,
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

    console.log("💸 Expense result:", expenseResult);

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
    res.status(500).json({ error: "Failed to fetch live status" });
  }
};




export default { createDailyBranchSnapshot,getLiveBranchSnapshot, getLiveStatus };
  