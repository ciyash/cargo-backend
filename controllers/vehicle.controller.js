import Vehicle from '../models/vehicle.model.js';

// Create a new vehicle
const createVehicle = async (req, res) => {
    try {
        const { vehicleNo, vehicleType, registrationNo, date, RC, polutionExpDate, fuelType, branch,vehicleStatus } = req.body;

        if (!vehicleNo || !vehicleType || !registrationNo || !date || !RC || !polutionExpDate || !fuelType || !branch ) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const vehicle = new Vehicle({
            vehicleNo,
            vehicleType,
            registrationNo,
            date,
            RC,
            polutionExpDate,
            fuelType,
            branch,
            vehicleStatus
        });

        await vehicle.save();
        res.status(201).json(vehicle);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all vehicles
const getAllVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find()
        res.status(200).json(vehicles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single vehicle by ID
const getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;
        const vehicle = await Vehicle.findById(id).populate("branch", "branchName");

        if (!vehicle) return res.status(404).json({ message: "Vehicle not found" });

        res.status(200).json(vehicle);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getVehicleNo=async(req,res) => {
    try{
      const {vehicleNo}=req.params
      const vehicle=await Vehicle.findOne({vehicleNo})
      if(!vehicle){
        return res.status(404).json({message:"No vehicle found !"})
      }
      res.status(200).json(vehicle)
    }
    catch(error){
        res.status(500).json({error:error.message})
    }
}

const updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedVehicle = await Vehicle.findByIdAndUpdate(id, req.body, { 
            new: true, 
            runValidators: true  
        });

        if (!updatedVehicle) return res.status(404).json({ message: "Vehicle not found" });

        res.status(200).json({message:"updated successfully vehicle",updatedVehicle});
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteVehicle = async (req, res) => {
    try {
        const deletedVehicle = await Vehicle.findByIdAndDelete(req.params.id);

        if (!deletedVehicle) return res.status(404).json({ message: "Vehicle not found" });

        res.status(200).json({ message: "Vehicle deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Export all controllers
export default {
    createVehicle,
    getAllVehicles,
    getVehicleById,
    updateVehicle,
    deleteVehicle,
    getVehicleNo
};
