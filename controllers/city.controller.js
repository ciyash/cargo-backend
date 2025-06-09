import { City } from '../models/multi.model.js';

// Create City
const createCity = async (req, res) => {
  try {
    const { cityName, state, code, address } = req.body;

   const companyId = req.user?.companyId;


    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    const existCity = await City.findOne({ cityName, companyId });
    if (existCity) {
      return res.status(400).json({ message: "City already exists" });
    }

    const newCity = new City({ cityName, state, code, address, companyId });
    await newCity.save();

    res.status(201).json({ message: "City added successfully", city: newCity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get All Cities for the Company
const getCities = async (req, res) => {
  try {
   const companyId = req.user?.companyId;


    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    const cities = await City.find({ companyId });
    if( !cities || cities.length === 0) {
      return res.status(404).json({ message: "No cities found for this company" });
    }
    res.status(200).json(cities);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update City by ID and Company
const updateCity = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const updatedCity = await City.findOneAndUpdate(
      { _id: id, companyId },
      req.body,
      { new: true }
    );

    if (!updatedCity) {
      return res.status(404).json({ success: false, message: "City not found" });
    }

    res.status(200).json({ message: "City updated", city: updatedCity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete City by ID and Company
const deleteCity = async (req, res) => {
  try {
    const { id } = req.params;
    const companyId = req.companyId;

    const deletedCity = await City.findOneAndDelete({ _id: id, companyId });

    if (!deletedCity) {
      return res.status(404).json({ message: "City not found" });
    }

    res.status(200).json({ message: "City deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete Selected Cities by IDs and Company
const deleteSelectedCities = async (req, res) => {
  try {
    const { cityIds } = req.body;
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized: Company ID missing" });
    }

    if (!cityIds || !Array.isArray(cityIds) || cityIds.length === 0) {
      return res.status(400).json({ success: false, message: "No valid city IDs provided" });
    }

    const isValidIds = cityIds.every(id => /^[0-9a-fA-F]{24}$/.test(id));
    if (!isValidIds) {
      return res.status(400).json({ success: false, message: "Invalid ObjectId format in cityIds" });
    }

    const result = await City.deleteMany({ _id: { $in: cityIds }, companyId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: "No matching cities found" });
    }

    res.status(200).json({
      success: true,
      message: "Selected cities deleted successfully",
      deletedCount: result.deletedCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error: error.message });
  }
};

export default {
  createCity,
  getCities,
  deleteCity,
  updateCity,
  deleteSelectedCities
};
