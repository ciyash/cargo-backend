// // controllers/branchReportController.js

// import {Booking} from '..//models/booking.model.js'
// import Branch from '../models/branch.model.js';
// import {Expense} from '../models/expensive.model.js';

//  const getBranchReport = async (req, res) => {
//   try {
 
//     const { fromDate, toDate,branchId } = req.body;

//     const branch = await Branch.findById(branchId);
//     if (!branch) {
//       return res.status(404).json({ message: "Branch not found" });
//     }

//     // Parse date range
//     const from = fromDate ? new Date(fromDate) : new Date("1970-01-01");
//     const to = toDate ? new Date(toDate) : new Date();

//     // 1. Get all bookings for this branch within date range
//     const bookings = await Booking.find({
//       bookbranchid: branchId,
//       bookingDate: { $gte: from, $lte: to }
//     });

//     const totalIncome = bookings.reduce((sum, b) => sum + b.grandTotal, 0);

//     // 2. Get all expenses for this branch within date range
//     const expenses = await Expense.find({
//       branchId,
//       expenseDate: { $gte: from, $lte: to }
//     });

//     const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

//     // 3. Calculate closing balance
//     const closingBalance = branch.openingBalance + totalIncome - totalExpenses;

//     res.status(200).json({
//       branch: {
//         name: branch.name,
//         city: branch.city,
//         branchType: branch.branchType,
//         openingBalance: branch.openingBalance,
//       },
//       reportPeriod: {
//         fromDate: from.toISOString().split("T")[0],
//         toDate: to.toISOString().split("T")[0]
//       },
//       income: {
//         totalBookings: bookings.length,
//         totalIncome,
//       },
//       expense: {
//         totalExpenses,
//         expenseDetails: expenses,
//       },
//       closingBalance
//     });

//   } catch (err) {
//     console.error("Error generating report", err);
//     res.status(500).json({ message: "Server Error" });
//   }
// };


// export default { getBranchReport };



import mongoose   from 'mongoose';
import Branch      from '../models/branch.model.js';
import { Booking } from '../models/booking.model.js';
import { Expense } from '../models/expensive.model.js';

const getBranchReport = async (req, res) => {
  try {
    const { branchId, fromDate, toDate } = req.body;   // all inputs in body

    /* 1️⃣  Date window -------------------------------------------------- */
    const from = fromDate ? new Date(fromDate) : new Date('1970-01-01');
    const to   = toDate   ? new Date(toDate)   : new Date();
    from.setHours(0, 0, 0, 0);                    // 00:00 AM inclusive
    to.setHours(23, 59, 59, 999);                 // 11:59:59 PM inclusive

    if (isNaN(from) || isNaN(to))
      return res.status(400).json({ message: 'Invalid date format' });

    /* 2️⃣  Which branches? --------------------------------------------- */
    const branchMatch = branchId
      ? { _id: new mongoose.Types.ObjectId(branchId) }
      : {};

    /* 3️⃣  Aggregation pipeline ---------------------------------------- */
    const report = await Branch.aggregate([
      { $match: branchMatch },

      /* A) Bookings inside window */
      {
        $lookup: {
          from: 'bookings',
          let: { bid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$bookbranchid', '$$bid'] },
                    { $gte: ['$bookingDate', from] },
                    { $lte: ['$bookingDate', to] }
                  ]
                }
              }
            },
            { $project: { grandTotal: 1, bookingType: 1 } }
          ],
          as: 'bookingsIn'
        }
      },

      /* B) Bookings BEFORE window (for opening balance) */
      {
        $lookup: {
          from: 'bookings',
          let: { bid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$bookbranchid', '$$bid'] },
                    { $lt: ['$bookingDate', from] }
                  ]
                }
              }
            },
            { $project: { grandTotal: 1 } }
          ],
          as: 'bookingsBefore'
        }
      },

      /* C) Expenses inside window */
      {
        $lookup: {
          from: 'expenses',
          let: { bid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$branchId', '$$bid'] },
                    { $gte: ['$expenseDate', from] },
                    { $lte: ['$expenseDate', to] }
                  ]
                }
              }
            },
            { $project: { amount: 1 } }
          ],
          as: 'expensesIn'
        }
      },

      /* D) Expenses BEFORE window */
      {
        $lookup: {
          from: 'expenses',
          let: { bid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$branchId', '$$bid'] },
                    { $lt: ['$expenseDate', from] }
                  ]
                }
              }
            },
            { $project: { amount: 1 } }
          ],
          as: 'expensesBefore'
        }
      },

      /* E) Calculated fields */
      {
        $addFields: {
          // Opening balance at 00:00 AM
          openingBalComputed: {
            $subtract: [
              { $add: ['$openingBalance', { $sum: '$bookingsBefore.grandTotal' }] },
              { $sum: '$expensesBefore.amount' }
            ]
          },

          // Income & expenses inside range
          totalIncome:   { $sum: '$bookingsIn.grandTotal' },
          totalExpenses: { $sum: '$expensesIn.amount' },

          // Income by type
          incomeByType: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: ['$bookingsIn.bookingType'] },
                as: 't',
                in: [
                  '$$t',
                  {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$bookingsIn',
                            as: 'b',
                            cond: { $eq: ['$$b.bookingType', '$$t'] }
                          }
                        },
                        as: 'f',
                        in: '$$f.grandTotal'
                      }
                    }
                  }
                ]
              }
            }
          },

          totalBookings: { $size: '$bookingsIn' },

          // Closing balance at 11:59 PM
          closingBalance: {
            $subtract: [
              { $add: [
                '$openingBalance',
                { $sum: '$bookingsBefore.grandTotal' },
                { $sum: '$bookingsIn.grandTotal' }
              ]},
              { $add: [
                { $sum: '$expensesBefore.amount' },
                { $sum: '$expensesIn.amount' }
              ]}
            ]
          }
        }
      },

      /* F) Final projection */
      {
        $project: {
          _id: 0,
          branch: {
            id: '$_id',
            branchUniqueId: '$branchUniqueId',
            name: '$name',
            city: '$city',
            state: '$state',
            branchType: '$branchType',
            openingBalance: '$openingBalComputed'
          },
          totalBookings: 1,
          totalIncome: 1,
          incomeByType: 1,
          totalExpenses: 1,
          closingBalance: 1
        }
      }
    ]);

    if (!report.length)
      return res.status(404).json({ message: 'No branch data found' });

    res.status(200).json({
      reportPeriod: {
        fromDate: from.toISOString().split('T')[0],
        toDate:   to.toISOString().split('T')[0]
      },
      totalBranches: report.length,
      branches: report
    });

  } catch (err) {
    console.error('Error generating branch report:', err);
    res.status(500).json({ error: err.message, message: 'Server Error' });
  }
};


const getDailyNetCollection = async (req, res) => {
  try {
    const { branchId, fromDate, toDate } = req.body;

    const from = fromDate ? new Date(fromDate) : new Date();   // default today
    const to   = toDate   ? new Date(toDate)   : new Date();

    // Normalise to full‑day window
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);

    if (isNaN(from) || isNaN(to))
      return res.status(400).json({ message: 'Invalid date format' });

    const branchMatch = branchId
      ? { _id: new mongoose.Types.ObjectId(branchId) }
      : {};

    const dailyReport = await Branch.aggregate([
      { $match: branchMatch },

      /* --- Join bookings within range ---------------------------------- */
      {
        $lookup: {
          from: 'bookings',
          let: { bid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$bookbranchid', '$$bid'] },
                    { $gte: ['$bookingDate', from] },
                    { $lte: ['$bookingDate', to] }
                  ]
                }
              }
            },
            {
              $project: {
                grandTotal: 1,
                day: { $dateToString: { format: '%Y-%m-%d', date: '$bookingDate' } }
              }
            }
          ],
          as: 'bookings'
        }
      },

      /* --- Join expenses within range ---------------------------------- */
      {
        $lookup: {
          from: 'expenses',
          let: { bid: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$branchId', '$$bid'] },
                    { $gte: ['$expenseDate', from] },
                    { $lte: ['$expenseDate', to] }
                  ]
                }
              }
            },
            {
              $project: {
                amount: 1,
                day: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } }
              }
            }
          ],
          as: 'expenses'
        }
      },

      /* --- Unwind into daily rows -------------------------------------- */
      { $unwind: { path: '$bookings', preserveNullAndEmptyArrays: true } },
      { $unwind: { path: '$expenses', preserveNullAndEmptyArrays: true } },

      /* --- Combine by day --------------------------------------------- */
      {
        $group: {
          _id: {
            branchId: '$_id',
            branchName: '$name',
            day: { $ifNull: ['$bookings.day', '$expenses.day'] }
          },
          income:   { $sum: '$bookings.grandTotal' },
          expenses: { $sum: '$expenses.amount' }
        }
      },
      {
        $addFields: {
          netIncome: { $subtract: ['$income', '$expenses'] }
        }
      },
      { $sort: { '_id.branchName': 1, '_id.day': 1 } },

      /* --- Reshape for output ----------------------------------------- */
      {
        $project: {
          _id: 0,
          branchId:   '$_id.branchId',
          branchName: '$_id.branchName',
          date:       '$_id.day',
          income: 1,
          expenses: 1,
          netIncome: 1
        }
      }
    ]);

    res.status(200).json({
      period: {
        fromDate: from.toISOString().split('T')[0],
        toDate:   to.toISOString().split('T')[0]
      },
      count: dailyReport.length,
      data: dailyReport
    });

  } catch (err) {
    console.error('Error generating daily net collection:', err);
    res.status(500).json({ message: 'Server Error', error: err.message });
  }
};

// const getDailyBranchSnapshot = async (req, res) => {
//   try {
//     const { pickUpBranch, date } = req.body;            // date = "YYYY-MM-DD"

//     if (!date) return res.status(400).json({ message: "date is required" });

//     const dayStart = new Date(date);
//     dayStart.setHours(0, 0, 0, 0);

//     const dayEnd   = new Date(date);
//     dayEnd.setHours(23, 59, 59, 999);

//     if (isNaN(dayStart)) return res.status(400).json({ message: "Invalid date" });

//     /* branch filter by pickUpBranch code (not _id) */
//     const branchFilter = pickUpBranch ? { pickUpBranch } : {};

//     /**  Pipeline  **/
//     const snapshot = await Booking.aggregate([
//       { $match: branchFilter },

//       /* Split INCOME buckets */
//       {
//         $facet: {
//           /* Income before dayStart (for opening) */
//           incomeBefore: [
//             { $match: { bookingDate: { $lt: dayStart } } },
//             { $group: {
//                 _id: "$pickUpBranch",
//                 amount: { $sum: "$grandTotal" }
//             }}
//           ],

//           /* Expenses before dayStart (for opening) */
//           expenseBefore: [
//             { $match: { bookingDate: { $lt: dayStart } } },
//             { $lookup: {
//                 from: "expenses",
//                 localField: "pickUpBranch",
//                 foreignField: "paidThrough",            // adjust if needed
//                 pipeline: [
//                   { $match: { expenseDate: { $lt: dayStart } } },
//                   { $group: { _id: null, amt: { $sum: "$amount" } } }
//                 ],
//                 as: "expB"
//             }},
//             { $addFields: { expenses: { $ifNull: [ { $arrayElemAt:["$expB.amt",0] }, 0 ] } } },
//             { $group: {
//                 _id: "$pickUpBranch",
//                 amount: { $first: "$expenses" }
//             }}
//           ],

//           /* Income during the day */
//           incomeToday: [
//             { $match: {
//                 bookingDate: { $gte: dayStart, $lte: dayEnd }
//             }},
//             { $group: {
//                 _id: "$pickUpBranch",
//                 amount: { $sum: "$grandTotal" }
//             }}
//           ]
//         }
//       },

//       /* Merge the 3 buckets */
//       {
//         $project: {
//           combined: {
//             $setUnion: [ "$incomeBefore._id", "$expenseBefore._id", "$incomeToday._id" ]
//           },
//           incomeBefore: 1,
//           expenseBefore: 1,
//           incomeToday: 1
//         }
//       },
//       { $unwind: "$combined" },
//       {
//         $project: {
//           branchCode: "$combined",
//           openingIncome: {
//             $ifNull: [
//               { $arrayElemAt: [
//                 {
//                   $filter: {
//                     input: "$incomeBefore",
//                     as: "b",
//                     cond: { $eq: ["$$b._id", "$combined"] }
//                   }
//                 }, 0] }, { amount: 0 }
//             ]
//           },
//           openingExpense: {
//             $ifNull: [
//               { $arrayElemAt: [
//                 {
//                   $filter: {
//                     input: "$expenseBefore",
//                     as: "b",
//                     cond: { $eq: ["$$b._id", "$combined"] }
//                   }
//                 }, 0] }, { amount: 0 }
//             ]
//           },
//           incomeToday: {
//             $ifNull: [
//               { $arrayElemAt: [
//                 {
//                   $filter: {
//                     input: "$incomeToday",
//                     as: "b",
//                     cond: { $eq: ["$$b._id", "$combined"] }
//                   }
//                 }, 0] }, { amount: 0 }
//             ]
//           }
//         }
//       },

//       /* Attach branch name from Branch collection */
//       { $lookup: {
//           from: "branches",
//           localField: "branchCode",
//           foreignField: "branchUniqueId",
//           pipeline: [ { $project: { _id:0, name:1 } } ],
//           as: "branchInfo"
//       }},

//       { $addFields: {
//           branchName: { $ifNull: [ { $arrayElemAt:["$branchInfo.name",0]}, "Unknown" ] }
//       }},

//       /* Final calc fields */
//       {
//         $addFields: {
//           openingBalance: {
//             $subtract: [
//               "$openingIncome.amount",
//               "$openingExpense.amount"
//             ]
//           },
//           income: "$incomeToday.amount"
//         }
//       },
//       {
//         $addFields: {
//           closingBalance: { $add: [ "$openingBalance", "$income" ] }
//         }
//       },

//       /* final project */
//       {
//         $project: {
//           _id:0,
//           branchCode:1,
//           branchName:1,
//           date: { $dateToString:{ format:"%Y-%m-%d", date: dayStart } },
//           openingBalance:1,
//           income:1,
//           expenses:{ $literal:0 },   // adjust if daily expenses table exists
//           closingBalance:1
//         }
//       }
//     ]);

//     res.json(snapshot);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message:"Server error", error: err.message });
//   }
// };




const getDailyBranchSnapshot = async (req, res) => {
  try {
    const { pickUpBranch, date } = req.body;

    if (!date) return res.status(400).json({ message: "date is required" });

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const branchFilter = pickUpBranch ? { pickUpBranch } : {};
    const expenseFilter = pickUpBranch ? { paidThrough: pickUpBranch } : {};

    // Booking Aggregates
    const [incomeBefore, incomeToday] = await Promise.all([
      Booking.aggregate([
        { $match: { ...branchFilter, bookingDate: { $lt: dayStart } } },
        {
          $group: {
            _id: "$pickUpBranch",
            totalIncomeBefore: { $sum: "$grandTotal" }
          }
        }
      ]),
      Booking.aggregate([
        {
          $match: {
            ...branchFilter,
            bookingDate: { $gte: dayStart, $lte: dayEnd }
          }
        },
        {
          $group: {
            _id: "$pickUpBranch",
            incomeToday: { $sum: "$grandTotal" }
          }
        }
      ])
    ]);

    // Expense Aggregates
    const [expenseBefore, expenseToday] = await Promise.all([
      Expense.aggregate([
        { $match: { ...expenseFilter, expenseDate: { $lt: dayStart } } },
        {
          $group: {
            _id: "$paidThrough",
            totalExpenseBefore: { $sum: "$amount" }
          }
        }
      ]),
      Expense.aggregate([
        {
          $match: {
            ...expenseFilter,
            expenseDate: {
              $gte: dayStart,
              $lte: dayEnd
            }
          }
        },
        {
          $group: {
            _id: "$paidThrough",
            expenseToday: { $sum: "$amount" }
          }
        }
      ])
    ]);

    // Combine all unique branch codes
    const branchCodes = new Set([
      ...incomeBefore.map(i => i._id),
      ...incomeToday.map(i => i._id),
      ...expenseBefore.map(e => e._id),
      ...expenseToday.map(e => e._id)
    ]);

    // Build snapshot per branch
    const snapshot = [];

    for (const branchCode of branchCodes) {
      const incomeBeforeVal = incomeBefore.find(i => i._id === branchCode)?.totalIncomeBefore || 0;
      const expenseBeforeVal = expenseBefore.find(e => e._id === branchCode)?.totalExpenseBefore || 0;
      const incomeTodayVal = incomeToday.find(i => i._id === branchCode)?.incomeToday || 0;
      const expenseTodayVal = expenseToday.find(e => e._id === branchCode)?.expenseToday || 0;

      const openingBalance = incomeBeforeVal - expenseBeforeVal;
      const closingBalance = openingBalance + incomeTodayVal - expenseTodayVal;

      const branchData = await Branch.findOne({ branchUniqueId: branchCode }, { name: 1 });

      snapshot.push({
        branchCode,
        branchName: branchData?.name || "Unknown",
        date: date,
        openingBalance,
        income: incomeTodayVal,
        expenses: expenseTodayVal,
        closingBalance
      });
    }

    return res.json(snapshot);
  } catch (err) {
    console.error("getDailyBranchSnapshot error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};


export default { getBranchReport, getDailyNetCollection, getDailyBranchSnapshot };

