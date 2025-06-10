import Vehicle from '../models/vehicle.model.js';

// Create a new vehicle
const createVehicle = async (req, res) => {
    try {
        const { vehicleNo, vehicleType, registrationNo, date, RC, polutionExpDate, fuelType, branch, vehicleStatus } = req.body;
        const companyId = req.user?.companyId;

        if (!companyId || !vehicleNo || !vehicleType || !registrationNo || !date || !RC || !polutionExpDate || !fuelType || !branch) {
            return res.status(400).json({ message: "All fields are required including companyId" });
        }

        const vehicle = new Vehicle({
            companyId,
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

// Get all vehicles for a company
const getAllVehicles = async (req, res) => {
    try {
        const companyId = req.companyId;
        if (!companyId) {
            return res.status(400).json({ message: "Company ID is required" });
        }

        const vehicles = await Vehicle.find({ companyId });
        res.status(200).json(vehicles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get a single vehicle by ID (validate company ownership)
const getVehicleById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.companyId;

        const vehicle = await Vehicle.findOne({ _id: id, companyId }).populate("branch", "branchName");

        if (!vehicle) return res.status(404).json({ message: "Vehicle not found or does not belong to your company" });

        res.status(200).json(vehicle);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get vehicle by vehicle number for a company
const getVehicleNo = async (req, res) => {
    try {
        const { vehicleNo } = req.params;
        const companyId = req.companyId;

        const vehicle = await Vehicle.findOne({ vehicleNo, companyId });
        if (!vehicle) {
            return res.status(404).json({ message: "No vehicle found for your company!" });
        }

        res.status(200).json(vehicle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update vehicle (ensure it belongs to the same company)
const updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.companyId;

        const vehicle = await Vehicle.findOneAndUpdate(
            { _id: id, companyId },
            req.body,
            { new: true, runValidators: true }
        );

        if (!vehicle) return res.status(404).json({ message: "Vehicle not found or not part of your company" });

        res.status(200).json({ message: "Vehicle updated successfully", updatedVehicle: vehicle });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Delete vehicle (ensure company ownership)
const deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = req.companyId;

        const deletedVehicle = await Vehicle.findOneAndDelete({ _id: id, companyId });

        if (!deletedVehicle) return res.status(404).json({ message: "Vehicle not found or not part of your company" });

        res.status(200).json({ message: "Vehicle deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get vehicles by status for a company
const getVehiclesByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const companyId = req.companyId;

        if (!["active", "inactive"].includes(status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Invalid status. Use 'active' or 'inactive'."
            });
        }

        const vehicles = await Vehicle.find({ vehicleStatus: status.toLowerCase(), companyId });

        res.status(200).json({
            success: true,
            message: `Vehicles with status '${status}' fetched successfully`,
            count: vehicles.length,
            data: vehicles
        });
    } catch (error) {
        console.error("Error fetching vehicles by status:", error);
        res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// Export all controllers
export default {
    createVehicle,
    getAllVehicles,
    getVehicleById,
    updateVehicle,
    deleteVehicle,
    getVehicleNo,
    getVehiclesByStatus
};
