// controllers/branchReportController.js

import {Booking} from '..//models/booking.model.js'
import Branch from '../models/branch.model.js';
import {Expense} from '../models/expensive.model.js';

 const getBranchReport = async (req, res) => {
  try {
    const { branchId } = req.params;
    const { fromDate, toDate } = req.query;

    const branch = await Branch.findById(branchId);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }

    // Parse date range
    const from = fromDate ? new Date(fromDate) : new Date("1970-01-01");
    const to = toDate ? new Date(toDate) : new Date();

    // 1. Get all bookings for this branch within date range
    const bookings = await Booking.find({
      bookbranchid: branchId,
      bookingDate: { $gte: from, $lte: to }
    });

    const totalIncome = bookings.reduce((sum, b) => sum + b.grandTotal, 0);

    // 2. Get all expenses for this branch within date range
    const expenses = await Expense.find({
      branchId,
      expenseDate: { $gte: from, $lte: to }
    });

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // 3. Calculate closing balance
    const closingBalance = branch.openingBalance + totalIncome - totalExpenses;

    res.status(200).json({
      branch: {
        name: branch.name,
        city: branch.city,
        branchType: branch.branchType,
        openingBalance: branch.openingBalance,
      },
      reportPeriod: {
        fromDate: from.toISOString().split("T")[0],
        toDate: to.toISOString().split("T")[0]
      },
      income: {
        totalBookings: bookings.length,
        totalIncome,
      },
      expense: {
        totalExpenses,
        expenseDetails: expenses,
      },
      closingBalance
    });

  } catch (err) {
    console.error("Error generating report", err);
    res.status(500).json({ message: "Server Error" });
  }
};


export default { getBranchReport };