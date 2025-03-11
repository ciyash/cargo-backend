import { City } from '../models/multi.model.js'
  
// Create City
 const createCity = async (req, res) => {
    try {
        const { cityName, state } = req.body;

        if(!cityName || !state){
          return res.status(404).json({message:"Required fields missing cityName state"})
        }

        const existCity=await City.findOne({cityName})

        if(existCity){
          return res.status(400).json({message:"Already city exist "})
        }

        const newCity = new City({ cityName, state });

        await newCity.save();
        res.status(201).json({message: "City added successfully", city: newCity });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get All Cities
 const getCities = async (req, res) => {
    try {
        const cities = await City.find();
        res.status(200).json(cities);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update City
 const updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedCity = await City.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedCity) return res.status(404).json({ success: false, message: "City not found" });
        res.status(200).json({message: "City updated", city: updatedCity });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete City
 const deleteCity = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCity = await City.findByIdAndDelete(id);
        if (!deletedCity) return res.status(404).json({message: "City not found" });
        res.status(200).json({message: "City deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
export default {createCity,getCities,deleteCity,updateCity}