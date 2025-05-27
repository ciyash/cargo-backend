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
const updateBranchSnapshotContinuously = async () => {
  try {
    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const branches = await Branch.find({});

    for (const branch of branches) {
      const branchCode = branch.branchUniqueId;

      // Check if today's snapshot exists
      let snapshot = await BranchDailySnapshot.findOne({
        branchCode,
        date: startOfDay,
      });

      // If not, create it with openingBalance
      if (!snapshot) {
        // Get last day's closing balance
        const lastSnapshot = await BranchDailySnapshot.findOne({ branchCode }).sort({ date: -1 });
        const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

        snapshot = await BranchDailySnapshot.create({
          branchCode,
          date: startOfDay,
          openingBalance,
          income: 0,
          expenses: 0,
          closingBalance: openingBalance,
        });
      }

      // Compute today's income
      const incomeResult = await Booking.aggregate([
        {
          $match: {
            pickUpBranch: branchCode,
            bookingDate: { $gte: startOfDay, $lt: endOfDay },
          },
        },
        {
          $group: {
            _id: null,
            totalIncome: { $sum: "$grandTotal" },
          },
        },
      ]);

      const income = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;

      // Compute today's expenses
      const expenseResult = await Expense.aggregate([
        {
          $match: {
            branchCode,
            date: { $gte: startOfDay, $lt: endOfDay },
          }, 
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
          },
        },
      ]);

      const expenses = expenseResult.length > 0 ? expenseResult[0].totalExpenses : 0;

      const closingBalance = snapshot.openingBalance + income - expenses;

      // Update today's snapshot
      snapshot.income = income;
      snapshot.expenses = expenses;
      snapshot.closingBalance = closingBalance;
      await snapshot.save();

      // console.log(`🔄 Snapshot updated for branch ${branchCode}`);
    }

    // console.log("✅ All branch snapshots updated.");  
  } catch (error) {
    console.error("❌ Error updating branch snapshot:", error);
  }
};



// const createDailyBranchSnapshot = async () => {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today);
//     tomorrow.setDate(today.getDate() + 1);

//     const branches = await Branch.find({}); // Get all branches

//     for (const branch of branches) {
//       const branchCode = branch.branchUniqueId;

//       // Get last closing balance
//       const lastSnapshot = await BranchDailySnapshot.findOne({ branchCode })
//         .sort({ date: -1 });

//       const openingBalance = lastSnapshot ? lastSnapshot.closingBalance : 0;

//       // Get today's income from Booking
//       const incomeResult = await Booking.aggregate([
//         {
//           $match: {
//             pickUpBranch: branchCode,
//             bookingDate: { $gte: today, $lt: tomorrow }
//           }
//         },
//         {
//           $group: {
//             _id: null,
//             totalIncome: { $sum: "$grandTotal" }
//           }
//         }
//       ]);
//       const income = incomeResult[0]?.totalIncome || 0;

//       // Get today's expense from Expense
//       const expenseResult = await Expense.aggregate([
//         {
//           $match: {
//             branchCode: branchCode,
//             date: { $gte: today, $lt: tomorrow }
//           }
//         },
//         {
//           $group: {
//             _id: null,
//             totalExpenses: { $sum: "$amount" }
//           }
//         }
//       ]);
//       const expenses = expenseResult[0]?.totalExpenses || 0;

//       const closingBalance = openingBalance + income - expenses;

//       // Save daily snapshot
//       await BranchDailySnapshot.create({
//         branchCode,
//         date: today,
//         openingBalance,
//         income,
//         expenses,
//         closingBalance
//       });

//       console.log(`✅ Snapshot saved for branch ${branchCode}`);
//     }

//     console.log("🎉 All branch snapshots created successfully.");
//   } catch (error) {
//     console.error("❌ Error creating branch snapshot:", error.message);
//   }
// };

// const getTodayBranchSummary = async (req, res) => {
//   try {
//     const { branchCode } = req.body;

//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const tomorrow = new Date(today);
//     tomorrow.setDate(today.getDate() + 1);

//     // Today's income
//     const incomeResult = await Booking.aggregate([
//       {
//         $match: {
//           pickUpBranch: branchCode,
//           bookingDate: { $gte: today, $lt: tomorrow }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           totalIncome: { $sum: "$grandTotal" }
//         }
//       }
//     ]);
//     const income = incomeResult.length > 0 ? incomeResult[0].totalIncome : 0;

//     // Today's expenses
//     const expenseResult = await Expense.aggregate([
//       {
//         $match: {
//           branchCode,
//           date: { $gte: today, $lt: tomorrow }
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           totalExpenses: { $sum: "$amount" }
//         }
//       }
//     ]);
//     const expenses = expenseResult.length > 0 ? expenseResult[0].totalExpenses : 0;

//     const net = income - expenses;

//     res.json({
//       branchCode,
//       date: today.toISOString().slice(0, 10), // YYYY-MM-DD
//       income,
//       expenses,
//       netBalance: net
//     });

//   } catch (error) {
//     console.error("❌ Error getting today's summary:", error.message);
//     res.status(500).json({ error: error.message });
//   }
// };

const getTodayBranchSummary = async (req, res) => {
  try {
    const { branchCode, date } = req.body;

    // Use provided date or default to today
    const baseDate = date ? new Date(date) : new Date();
    baseDate.setHours(0, 0, 0, 0);

    const nextDate = new Date(baseDate);
    nextDate.setDate(baseDate.getDate() + 1);

    // Income aggregation
    const incomeResult = await Booking.aggregate([
      {
        $match: {
          pickUpBranch: branchCode,
          bookingDate: { $gte: baseDate, $lt: nextDate }
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

    // Expenses aggregation
   // Corrected Expenses aggregation
const expenseResult = await Expense.aggregate([
  {
    $match: {
      branchCode,
      expenseDate: { $gte: baseDate, $lt: nextDate } // <-- updated field name
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

    const net = income - expenses;

    res.json({
      branchCode,
      date: baseDate.toISOString().slice(0, 10),
      income,
      expenses,
      netBalance: net
    });

  } catch (error) {
    console.error("❌ Error getting branch summary:", error.message);
    res.status(500).json({ error: error.message });
  }
};


const getDailyReport = async (req, res) => {
  try {
    const { branchCode, date } = req.body;

    // Convert string to Date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0); // 2025-05-27T00:00:00.000Z

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1); // 2025-05-28T00:00:00.000Z

    const snapshot = await BranchDailySnapshot.findOne({
      branchCode,
      date: { $gte: startOfDay, $lt: endOfDay },
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
        $sort: { date: 1 }
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

 
// Run every minute
setInterval(updateBranchSnapshotContinuously, 60 * 1000);

// Also run once immediately when server starts
updateBranchSnapshotContinuously();


export default { createDailyBranchSnapshot,getDailyReport,getMonthlyReport,getYearlyReport,getTodayBranchSummary };
