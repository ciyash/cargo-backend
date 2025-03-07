import ParcelUnloading from '../models/parcel.unloading.model.js'

const generateUnloadingVoucher = () => Math.floor(10000 + Math.random() * 90000);


 const createParcelUnloading = async (req, res) => {
    try {
        const { fromBookingDate, toBookingDate,unLoadingBy, fromCity, toCity, branch, vehicleNo, grnNo } = req.body;

        const newParcel = new ParcelUnloading({
            unLoadingVoucher: generateUnloadingVoucher(),
            fromBookingDate,
            toBookingDate,
            unLoadingBy,
            fromCity,
            toCity,
            branch,
            vehicleNo,
            grnNo
        });

        await newParcel.save();
        res.status(201).json({ message: "Parcel unloading created successfully", data: newParcel });
    } catch (error) {
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

export default {
    createParcelUnloading,
    getAllParcelUnloadings,
    getParcelUnloadingById,
    deleteParcelUnloading,
    updateParcelUnloading,
    getParcelunLoadingByGrnNumber,
    getParcelsByFilters,
    getParcelUnloadingByVoucher
}