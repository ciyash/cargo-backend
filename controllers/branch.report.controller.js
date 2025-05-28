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

const getLiveBranchStatus = async (branchCode) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // ఈరోజు మొదలు
    const now = new Date();      // ఇప్పటి సమయం

    // గత snapshot (opening balance కోసం)
    const lastSnapshot = await BranchDailySnapshot.findOne({ branchCode }).sort({ date: -1 });
    const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

    // Booking నుండి ఈ రోజు ఇప్పటి వరకు ఆదాయం లెక్క
    const incomeResult = await Booking.aggregate([
      {
        $match: {
          pickUpBranch: branchCode,
          bookingDate: { $gte: today, $lt: now }
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

    // Expense నుండి ఈ రోజు ఇప్పటి వరకు ఖర్చులు లెక్క
    const expenseResult = await Expense.aggregate([
      {
        $match: {
          branchCode,
          date: { $gte: today, $lt: now }
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

    // Calculate current closing balance
    const closingBalance = openingBalance + income - expenses;

    return {
      branchCode,
      openingBalance,
      income,
      expenses,
      closingBalance,
      lastUpdated: now
    };
  } catch (error) {
    console.error("Error fetching live branch status:", error);
    throw error;
  }
};



export default { createDailyBranchSnapshot,getLiveBranchSnapshot,getLiveBranchStatus };
