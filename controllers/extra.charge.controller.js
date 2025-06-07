import Charge from "../models/extra.charge.model.js";

// Create a new charge
const createCharge = async (req, res) => {
  try {
    const {
      fromCity,
      toCity,
      GST,
      serviceCharge,
      loadingCharge,
      cartageCharge,
      isActive
    } = req.body;

    const companyId = req.companyId;

    if (
      !fromCity ||
      !toCity ||
      !serviceCharge ||
      !loadingCharge ||
      !cartageCharge ||
      !companyId
    ) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const charge = new Charge({
      companyId,
      fromCity,
      toCity,
      GST,
      serviceCharge,
      loadingCharge,
      cartageCharge,
      isActive
    });

    await charge.save();
    res.status(201).json({ message: "Successfully added extra charge", charge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all extra charges for the company
const getAllExtraCharge = async (req, res) => {
  try {
    const companyId = req.companyId;

    const charges = await Charge.find({ companyId });
    if (charges.length === 0) {
      return res
        .status(404)
        .json({ message: "No extra charges found for this company!" });
    }
    res.status(200).json(charges);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get charges from city to city for the company
const getChargeFromCityToCity = async (req, res) => {
  try {
    const { fromCity, toCity } = req.body;
    const companyId = req.companyId;

    if (!fromCity || !toCity) {
      return res
        .status(400)
        .json({ message: "fromCity and toCity fields are required!" });
    }

    const charges = await Charge.find({
      companyId,
      fromCity: { $regex: new RegExp(`^${fromCity}$`, "i") },
      toCity: { $regex: new RegExp(`^${toCity}$`, "i") }
    });

    if (charges.length === 0) {
      return res.status(404).json({
        message: "No charge data found for these cities in this company!"
      });
    }

    res.status(200).json(charges);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching charge data", error: error.message });
  }
};

// Delete charge by ID (only for the company's charge)
const deleteCharge = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const deletedCharge = await Charge.findOneAndDelete({ _id: id, companyId });

    if (!deletedCharge) {
      return res.status(404).json({ message: "Charge not found for this company!" });
    }

    res.status(200).json({ message: "Charge deleted successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting charge", error: error.message });
  }
};

// Update charge by ID (only for the company's charge)
const updateChargeById = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;
    const updateData = req.body;

    const updatedCharge = await Charge.findOneAndUpdate(
      { _id: id, companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedCharge) {
      return res.status(404).json({ message: "Charge not found for this company!" });
    }

    res.status(200).json({ message: "Charge updated successfully!", updatedCharge });
  } catch (error) {
    res.status(500).json({ message: "Error updating charge", error: error.message });
  }
};

export default {
  createCharge,
  getAllExtraCharge,
  getChargeFromCityToCity,
  deleteCharge,
  updateChargeById
};
