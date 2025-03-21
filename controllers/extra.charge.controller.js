import Charge from "../models/extra.charge.model.js";

const createCharge = async (req, res) => {
  try {
    const {
      fromCity,
      toCity,
      GST,
      serviceCharge,
      loadingCharge,
      cartageCharge,
      isActive,
    } = req.body;
    if (
      !fromCity ||
      !toCity ||
      !GST ||
      !serviceCharge ||
      !loadingCharge ||
      !cartageCharge
    ) {
      return res.status(400).json({ message: "Required fields is missing !" });
    }
    const charge = new Charge({
      fromCity,
      toCity,
      GST,
      serviceCharge,
      loadingCharge,
      cartageCharge,
      isActive,
    });
    await charge.save();
    res
      .status(201)
      .json({ message: "Successfully added to extra chrage", charge });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getAllExtraCharge = async (req, res) => {
  try {
    const charge = await Charge.find();
    if (charge.length === 0) {
      return res
        .status(404)
        .json({ message: "No extra charge in this database!" });
    }
    res.status(200).json(charge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getChargeFromCityToCity = async (req, res) => {
    try {
      const { fromCity, toCity } = req.body;
  
      if (!fromCity || !toCity) {
        return res.status(400).json({ message: "fromCity and toCity fields are required!" });
      }
  
      const charges = await Charge.find({
        fromCity: { $regex: new RegExp(`^${fromCity}$`, "i") }, // Case-insensitive match
        toCity: { $regex: new RegExp(`^${toCity}$`, "i") }      // Case-insensitive match
      });
  
      if (charges.length === 0) {
        return res.status(404).json({ message: "No charge data found for these cities!" });
      }
  
      res.status(200).json(charges);
    } catch (error) {
      res.status(500).json({ message: "Error fetching charge data", error: error.message });
    }
  };
    
  const deleteCharge = async (req, res) => {
    try {
      const { id } = req.params;
  
      const deletedCharge = await Charge.findByIdAndDelete(id)
  
      if (!deletedCharge) {
        return res.status(404).json({ message: "Charge not found for these id!" });
      }
  
      res.status(200).json({ message: "Charge deleted successfully!" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting charge", error: error.message });
    }
  };
  
  
  const updateChargeById = async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
    
      const updatedCharge = await Charge.findByIdAndUpdate(id, updateData, { new: true,runValidators: true  });
  
      if (!updatedCharge) {
        return res.status(404).json({ message: "Charge not found!" });
      }
  
      res.status(200).json({ message: "Charge updated successfully!", updatedCharge });
    } catch (error) {
      res.status(500).json({ message: "Error updating charge", error: error.message });
    }
  };
  
export default { createCharge, getAllExtraCharge, getChargeFromCityToCity,deleteCharge,updateChargeById };
