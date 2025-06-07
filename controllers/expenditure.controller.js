import { Expenditure } from '../models/multi.model.js';

const createExpenditure = async (req, res) => {
  try {
    const {
      name,
      expenditureType,
      expenditureDate,
      expenditureStatus,
      value,
      date,
      remarks
    } = req.body;

    const companyId = req.companyId;

    if (!name || !expenditureType || !value || !date || !companyId) {
      return res.status(400).json({ success: false, message: "Required fields are missing" });
    }

    const newExpenditure = new Expenditure({
      companyId,
      name,
      expenditureType,
      expenditureDate,
      expenditureStatus,
      value,
      date,
      remarks
    });

    await newExpenditure.save();

    res.status(201).json({
      success: true,
      message: "Expenditure added",
      expenditure: newExpenditure
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getExpenditures = async (req, res) => {
  try {
    const companyId = req.companyId;

    const expenditures = await Expenditure.find({ companyId });

    if (expenditures.length === 0) {
      return res.status(404).json({ success: false, message: "No expenditures found" });
    }

    res.status(200).json(expenditures);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getExpenditureByType = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { expenditureType } = req.params;

    const expenditure = await Expenditure.find({ companyId, expenditureType });

    if (!expenditure || expenditure.length === 0) {
      return res.status(404).json({ success: false, message: "Expenditures not found for this type" });
    }

    res.status(200).json(expenditure);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getExpendituresByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.body;
    const companyId = req.companyId;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, message: "Start date and end date are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const expenditures = await Expenditure.find({
      companyId,
      date: { $gte: start, $lte: end }
    });

    if (expenditures.length === 0) {
      return res.status(404).json({ success: false, message: "No expenditures found in this date range" });
    }

    res.status(200).json(expenditures);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const updateExpenditure = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const {
      name,
      expenditureType,
      expenditureDate,
      expenditureStatus,
      value,
      date,
      remarks
    } = req.body;

    const updatedExpenditure = await Expenditure.findOneAndUpdate(
      { _id: id, companyId },
      {
        name,
        expenditureType,
        expenditureDate,
        expenditureStatus,
        value,
        date,
        remarks
      },
      { new: true }
    );

    if (!updatedExpenditure) {
      return res.status(404).json({ success: false, message: "Expenditure not found for this company" });
    }

    res.status(200).json({ success: true, message: "Expenditure updated", expenditure: updatedExpenditure });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const deleteExpenditure = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const deletedExpenditure = await Expenditure.findOneAndDelete({ _id: id, companyId });

    if (!deletedExpenditure) {
      return res.status(404).json({ success: false, message: "Expenditure not found for this company" });
    }

    res.status(200).json({ success: true, message: "Expenditure deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export default {
  createExpenditure,
  getExpenditures,
  getExpenditureByType,
  updateExpenditure,
  deleteExpenditure,
  getExpendituresByDateRange
};
