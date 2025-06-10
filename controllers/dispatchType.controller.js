import { DispatchType } from '../models/multi.model.js';

// Create Dispatch Type
const createDispatchType = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const newDispatchType = new DispatchType({ name, isActive, companyId });
    await newDispatchType.save();

    res.status(201).json({ message: "Dispatch Type added", dispatchType: newDispatchType });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Get All Dispatch Types for the Company
const getDispatchTypes = async (req, res) => {
  try {
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    const dispatchTypes = await DispatchType.find({ companyId });

    if (dispatchTypes.length === 0) {
      return res.status(404).json({ success: false, message: "No dispatch types found" });
    }

    res.status(200).json(dispatchTypes);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Get Dispatch Type by ID and Company
const getDispatchTypeById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const dispatchType = await DispatchType.findOne({ _id: id, companyId });

    if (!dispatchType) {
      return res.status(404).json({ success: false, message: "Dispatch Type not found" });
    }

    res.status(200).json({ success: true, dispatchType });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Update Dispatch Type by ID and Company
const updateDispatchType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, isActive } = req.body;
    const companyId = req.user?.companyId;

    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const updatedDispatchType = await DispatchType.findOneAndUpdate(
      { _id: id, companyId },
      { name, isActive },
      { new: true }
    );

    if (!updatedDispatchType) {
      return res.status(404).json({ success: false, message: "Dispatch Type not found" });
    }

    res.status(200).json({ success: true, message: "Dispatch Type updated", dispatchType: updatedDispatchType });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// Delete Dispatch Type by ID and Company
const deleteDispatchType = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.user?.companyId;

    const deletedDispatchType = await DispatchType.findOneAndDelete({ _id: id, companyId });

    if (!deletedDispatchType) {
      return res.status(404).json({ success: false, message: "Dispatch Type not found" });
    }

    res.status(200).json({ success: true, message: "Dispatch Type deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

export default {
  createDispatchType,
  getDispatchTypes,
  getDispatchTypeById,
  deleteDispatchType,
  updateDispatchType
};
