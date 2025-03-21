import ParcelUnloading from '../models/parcel.unloading.model.js'
import {Booking} from '../models/booking.model.js'
import ParcelLoading from '../models/pracel.loading.model.js'


const getParcelsLoading = async (req, res) => {  
    try {
        const { fromDate, toDate, fromCity, toCity, vehicalNumber, branch } = req.body;

        // Validate required fields
        if (!fromDate || !toDate) {
            return res.status(400).json({ message: "fromDate and toDate are required" });
        }

        // Parse and validate date formats
        const startOfDay = new Date(fromDate);
        const endOfDay = new Date(toDate);

        if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD." });
        }

        startOfDay.setUTCHours(0, 0, 0, 0);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Base filter with date range
        let filter = {
            fromBookingDate: { $gte: startOfDay, $lte: endOfDay },
        };

        // Ensure at least one matching condition
        let orConditions = [];

        if (Array.isArray(fromCity) && fromCity.length > 0) {
            orConditions.push({ fromCity: { $in: fromCity } });
        }

        if (toCity) {
            orConditions.push({ toCity });
        }

        if (Array.isArray(branch) && branch.length > 0) {
            orConditions.push({ branch: { $in: branch } });
        }

        if (orConditions.length > 0) {
            filter.$or = orConditions;
        }

        // ✅ Check vehicle number
        if (Array.isArray(vehicalNumber) && vehicalNumber.length > 0) {
            filter.vehicalNumber = { $in: vehicalNumber };
        }

        // Log filter to debug
        console.log("Generated Filter:", JSON.stringify(filter, null, 2));

        // Fetch parcels based on filters
        const parcels = await ParcelLoading.find(filter);

        // If no parcels found, return 404
        if (parcels.length === 0) {
            return res.status(404).json({ message: "No parcels found!" });
        }

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message,
        });
    }
};



const generateUnloadingVoucher = () => Math.floor(10000 + Math.random() * 90000);  

const createParcelUnloading = async (req, res) => {
    try {
        const { fromBookingDate, toBookingDate, fromCity, toCity, branch, vehicleNo, lrNumber, grnNo, bookingType } = req.body;

        if (!grnNo || !Array.isArray(grnNo) || grnNo.length === 0) {
            return res.status(400).json({ message: "GRN numbers are required and should be an array" });
        }

        // Convert all GRN numbers to numbers (if they are strings)
        const grnNumbers = grnNo.map(num => Number(num));

        const unLoadingBy = req.user.id;
        const currentDate = new Date();

        // Check if all GRN numbers exist
        const existingBookings = await Booking.find({ grnNo: { $in: grnNumbers } });
        const existingGrnNumbers = existingBookings.map(booking => booking.grnNo);

        // Identify missing GRNs
        const missingGrnNumbers = grnNumbers.filter(grn => !existingGrnNumbers.includes(grn));

        if (missingGrnNumbers.length > 0) {
            return res.status(400).json({ 
                message: "Some GRN numbers do not exist in the system",
                missingGrnNumbers 
            });
        }

        // Update booking status and unloading date
        await Booking.updateMany(
            { grnNo: { $in: grnNumbers } },
            { $set: { bookingStatus: 2, unloadingDate: currentDate } }
        );

        // Create a new Parcel Unloading entry
        const newParcel = new ParcelUnloading({
            unLoadingVoucher: generateUnloadingVoucher(),
            fromBookingDate,
            toBookingDate,
            unLoadingBy,
            fromCity,
            toCity,
            branch,
            vehicleNo,
            lrNumber,
            grnNo: grnNumbers,
            bookingType,
            createdAt: currentDate,
        });

        await newParcel.save();

        res.status(201).json({ message: "Parcel unloading created successfully", data: newParcel });
    } catch (error) {
        console.error("Error creating parcel unloading:", error);
        res.status(500).json({ message: "Error creating parcel unloading", error: error.message });
    }
};

 const getAllParcelUnloadings = async (req, res) => {
    try {
        const parcels = await ParcelUnloading.find();
        if (parcels.length === 0) return res.status(404).json({ message: "No parcels found" });

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ message: "Error fetching parcels", error: error.message });
    }
};

 const getParcelUnloadingById = async (req, res) => {
    try {
        const { id } = req.params;
        const parcel = await ParcelUnloading.findById(id);

        if (!parcel) return res.status(404).json({ message: "Parcel unloading not found" });

        res.status(200).json(parcel);
    } catch (error) {
        res.status(500).json({ message: "Error fetching parcel", error: error.message });
    }
};
const getParcelsByFilters = async (req, res) => {
    try {
        const { fromDate, toDate, fromCity, toCity, branch, vehicleNo } = req.body; // ✅ Read from body

        const query = {};

        if (fromDate && toDate) {
            query.fromBookingDate = { $gte: new Date(fromDate), $lte: new Date(toDate) }; 
        }
        if (fromCity) query.fromCity = fromCity;
        if (toCity) query.toCity = toCity;
        if (vehicleNo) query.vehicleNo = vehicleNo;
        if (branch) query.branch = branch;

        const parcels = await ParcelUnloading.find(query);

        if (!parcels.length) {
            return res.status(404).json({ message: "No parcels found" });
        }

        res.status(200).json(parcels);
    } catch (error) {
        console.error("Error fetching parcels:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getParcelunLoadingByGrnNumber = async (req, res) => {
    try {
        const { grnNo } = req.params;

        if (!grnNo) {
            return res.status(400).json({ message: "GRN number is required" });
        }

        const parcel = await ParcelUnloading.findOne({ grnNo: grnNo });

        if (!parcel) {
            return res.status(404).json({ message: "Parcel not found" });
        }

        res.status(200).json(parcel);
    } catch (error) {
        res.status(500).json({error:error.message}); 
    }
};

const getParcelUnloadingByVoucher = async (req, res) => {
    try {
        const { voucher } = req.params; 

        const parcel = await ParcelUnloading.findOne({ unLoadingVoucher: voucher });

        if (!parcel) {
            return res.status(404).json({ message: "Parcel unloading not found" });
        }

        res.status(200).json(parcel);
    } catch (error) {
        res.status(500).json({ message: "Error fetching parcel unloading", error: error.message });
    }
};

 const updateParcelUnloading = async (req, res) => {
    try {
        const { id } = req.params;

        const updatedParcel = await ParcelUnloading.findByIdAndUpdate(id, req.body, { new: true });

        if (!updatedParcel) return res.status(404).json({ message: "Parcel unloading not found" });

        res.status(200).json({ message: "Parcel unloading updated successfully", data: updatedParcel });
    } catch (error) {
        res.status(500).json({ message: "Error updating parcel", error: error.message });
    }
};

 const deleteParcelUnloading = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedParcel = await ParcelUnloading.findByIdAndDelete(id);

        if (!deletedParcel) return res.status(404).json({ message: "Parcel unloading not found" });

        res.status(200).json({ message: "Parcel unloading deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting parcel", error: error.message });
    }
};

const getUnloadingReport = async (req, res) => {
    try {
        const { fromDate, toDate, fromCity, toCity, fromBranch, bookingType } = req.body;

      
        if (!fromDate || !toDate || !fromCity || !toCity || !fromBranch) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const unloadingRecords = await ParcelUnloading.find({
            fromBookingDate: { $gte: new Date(fromDate) },
            toBookingDate: { $lte: new Date(toDate) },
            fromCity,
            toCity,
            branch: fromBranch,
            ...(bookingType && { bookingType }) 
        });

        if (unloadingRecords.length === 0) {
            return res.status(404).json({ success: false, message: "No records found" });
        }

        res.status(200).json(unloadingRecords);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


export default {
    createParcelUnloading,
    getAllParcelUnloadings,
    getParcelUnloadingById,
    deleteParcelUnloading,
    updateParcelUnloading,
    getParcelunLoadingByGrnNumber,
    getParcelsByFilters,
    getParcelUnloadingByVoucher,
    getUnloadingReport,
    getParcelsLoading
}