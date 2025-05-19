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

    const branches = await Branch.find({}); // Get all branches

    for (const branch of branches) {
      const branchCode = branch.branchUniqueId;

      // Get last closing balance
      const lastSnapshot = await BranchDailySnapshot.findOne({ branchCode })
        .sort({ date: -1 });

      const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

      // Get today's income from Booking
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
      const income = incomeResult[0]?.totalIncome || 0;

      // Get today's expense from Expense
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
      const expenses = expenseResult[0]?.totalExpenses || 0;

      const closingBalance = openingBalance + income - expenses;

      // Save daily snapshot
      await BranchDailySnapshot.create({
        branchCode,
        date: today,
        openingBalance,
        income,
        expenses,
        closingBalance
      });

      console.log(`✅ Snapshot saved for branch ${branchCode}`);
    }

    console.log("🎉 All branch snapshots created successfully.");
  } catch (error) {
    console.error("❌ Error creating branch snapshot:", error.message);
  }
};


const getDailyReport = async (req, res) => {
  try {
    const { branchCode, date } = req.body;

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const snapshot = await BranchDailySnapshot.findOne({
      branchCode,
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    if (!snapshot) {
      return res.status(404).json({ message: "Report not found." });
    }

    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMonthlyReport = async (req, res) => {
  try {
    const { branchCode, month, year } = req.body; // month = 0 to 11

    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 1);

    const data = await BranchDailySnapshot.aggregate([
      {
        $match: {
          branchCode,
          date: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: "$income" },
          totalExpenses: { $sum: "$expenses" },
          openingBalance: { $first: "$openingBalance" },
          closingBalance: { $last: "$closingBalance" }
        }
      }
    ]);

    if (!data.length) {
      return res.status(404).json({ message: "No data found" });
    }

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getYearlyReport = async (req, res) => {
  try {
    const { branchCode, year } = req.body;

    const startDate = new Date(year, 0, 1); // Jan 1st
    const endDate = new Date(year + 1, 0, 1); // Next Jan 1st

    const data = await BranchDailySnapshot.aggregate([
      {
        $match: {
          branchCode,
          date: { $gte: startDate, $lt: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: { $sum: "$income" },
          totalExpenses: { $sum: "$expenses" },
          openingBalance: { $first: "$openingBalance" },
          closingBalance: { $last: "$closingBalance" }
        }
      }
    ]);

    if (!data.length) {
      return res.status(404).json({ message: "No data found" });
    }

    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


export default { createDailyBranchSnapshot,getDailyReport,getMonthlyReport,getYearlyReport };
