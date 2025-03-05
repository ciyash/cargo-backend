import ParcelLoading from "../models/pracel.loading.model.js";
import Booking from '../models/booking.model.js'

const generateVocherNoUnique=()=>{
    return Math.floor(100000+Math.random()*900000)
}

const createParcel = async (req, res) => {
    try {
        const {
            parcelType, fromBranch, toBranch,loadingDate,parcelStatus,userName, unloadBranch, vehicalType, vehicalNumber,
            driverName, driverNo, fromBookingDate, toBookingDate,
            fromCity, toCity, remarks, grnNo, lrNumber
        } = req.body;

        if (!parcelType || !fromBranch || !toBranch || !vehicalType || !vehicalNumber || !driverName || !driverNo ||
            !fromBookingDate || !toBookingDate || !fromCity || !toCity || !remarks ||
            !Array.isArray(grnNo) || grnNo.length === 0 || !Array.isArray(lrNumber) || lrNumber.length === 0) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        const vocherNoUnique = generateVocherNoUnique();

        const parcel = new ParcelLoading({
            parcelType,
            vehicalNumber,
            parcelStatus,
            userName,
            vocherNoUnique,
            fromBranch,
            toBranch,
            loadingDate,
            unloadBranch: unloadBranch || "",
            vehicalType,
            driverName,
            driverNo,
            fromBookingDate,
            toBookingDate,
            fromCity,
            toCity,
            remarks,
            grnNo,
            lrNumber
        });

        await parcel.save();
        res.status(201).json({ message: "Parcel created successfully", parcel });
    } catch (error) {
        console.error("Error creating parcel:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};  


const getAllParcels = async (req, res) => {
    try {
        const parcels = await ParcelLoading.find()
        if(!parcels){
            return res.status(400).json({message:"no prcels found !"})
        }
        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


  const getParcelLoadingDates = async (req, res) => {
    try {
      const { fromBookingDate, toBookingDate, userName } = req.body;
  
      // Validate required fields
      if (!fromBookingDate || !toBookingDate || !userName) {
        return res.status(400).json({ success: false, message: "All fields are required" });
      }
  
      // Find bookings that exactly match the provided data
      const bookings = await ParcelLoading.find({
        fromBookingDate: new Date(fromBookingDate),
        toBookingDate: new Date(toBookingDate),
        userName
      });
  
      res.status(200).json({ success: true, bookings });
    } catch (error) {
      res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
  };
  


const getParcelVocherNoUnique=async(req,res) => {
    try{
      const {vocherNoUnique}=req.params
      const parcels=await ParcelLoading.findOne({vocherNoUnique})
      if(!parcels){
        return res.status(404).json({message:"data not found in parcels !"})
      }
      res.status(200).json(parcels)
    }
    catch(error){
        res.status(500).json({error:error.message})
    }
}

const getParcelById = async (req, res) => {
    try {
        const { id } = req.params;
        const parcel = await ParcelLoading.findById(id).populate("branch", "branchName");

        if (!parcel) return res.status(404).json({ message: "Parcel not found" });

        res.status(200).json(parcel);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const updateParcel = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedParcel = await ParcelLoading.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

        if (!updatedParcel) return res.status(404).json({ message: "Parcel not found" });

        res.status(200).json(updatedParcel);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


const deleteParcel = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedParcel = await ParcelLoading.findByIdAndDelete(id);

        if (!deletedParcel) return res.status(404).json({ message: "Parcel not found" });

        res.status(200).json({ message: "Parcel deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
const getParcelsByFilter = async (req, res) => {
    try {
        const { fromBookingDate, fromCity, toBookingDate, toCity } = req.body;

        let query = {};

        if (fromBookingDate) query.fromBookingDate = new Date(fromBookingDate);
        if (toBookingDate) query.toBookingDate = new Date(toBookingDate);
        if (fromCity) query.fromCity = fromCity;
        if (toCity) query.toCity = toCity;

        const parcels = await ParcelLoading.find(query);

        if (parcels.length === 0) return res.status(404).json({ message: "No parcels found" });

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


    const branchToBranchLoading = async (req, res) => {
        try {
            const { fromBookingDate, toBookingDate, branch } = req.body;
    
            // Build the query object dynamically
            let query = {};
    
            if (fromBookingDate) query.fromBookingDate = new Date(fromBookingDate);
            if (toBookingDate) query.toBookingDate = new Date(toBookingDate);
            if (branch) query.branchId = fromBranch; 
    
            const parcels = await ParcelLoading.find(query).populate("branch", "branchName");
    
            if (parcels.length === 0) return res.status(404).json({ message: "No parcels found" });
    
            res.status(200).json(parcels);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
};

 const updateAllGrnNumbers = async (req, res) => {
    try {
        const { grnNumbers, updateFields } = req.body;

        if (!grnNumbers || !Array.isArray(grnNumbers) || grnNumbers.length === 0) {
            return res.status(400).json({ message: "Invalid or missing grnNumbers array" });
        }

        if (!updateFields || typeof updateFields !== "object" || Object.keys(updateFields).length === 0) {
            return res.status(400).json({ message: "Invalid or missing updateFields object" });
        }

        // Add `updatedAt` field to the update object
        updateFields.updatedAt = new Date();

        // Find all bookings before update
        const beforeUpdate = await Booking.find({ grnNumber: { $in: grnNumbers } });

        // Update all records matching grnNumbers with dynamic fields
        const updateResult = await Booking.updateMany(
            { grnNumber: { $in: grnNumbers } },
            { $set: updateFields }
        );

        // Fetch all updated records
        const afterUpdate = await Booking.find({ grnNumber: { $in: grnNumbers } });

        return res.status(200).json({
            message: `Successfully updated ${updateResult.modifiedCount} records`,
            beforeUpdate,
            afterUpdate
        });

    } catch (error) {
        console.error("Error updating GRN numbers:", error);
        return res.status(500).json({ message: "Internal Server Error", error: error.message });
    }
};


 const getParcelByLrNumber = async (req, res) => {
    try {
        const { lrNumber } = req.body;

        if (!lrNumber) {
            return res.status(400).json({ message: "lrNumber is required" });
        }

        const parcel = await ParcelLoading.find({ lrNumber: { $in: [lrNumber] } })
            .populate("bookingId",'')  
            
            .populate("vehicalId","vehicleNo vehicleType"); 

        if (!parcel) {
            return res.status(404).json({ message: "Parcel not found" });
        }

        res.status(200).json(parcel);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getParcelByVehicalNumber = async (req, res) => {
    try {
        const { vehicalNumber } = req.params;

        const parcel = await ParcelLoading.find({vehicalNumber})

        res.status(200).json(parcel);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


 const getParcelsByBranch = async (req, res) => {
    try {
        const { fromBranch, toBranch } = req.params

        if (!fromBranch || !toBranch) {
            return res.status(400).json({ message: "Both fromBranch and toBranch are required." });
        }

        // Find parcels matching fromBranch and toBranch
        const parcels = await ParcelLoading.find({ fromBranch, toBranch });

        if (!parcels.length) {
            return res.status(404).json({ message: "No parcels found for the given branches." });
        }

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getParcelLoadingBetweenDates = async (req, res) => {
    try {
      const { fromBookingDate, toBookingDate } = req.body;
  
      if (!fromBookingDate || !toBookingDate) {
        return res.status(400).json({ message: "fromBookingDate and toBookingDate are required!" });
      }
      const parcels = await ParcelLoading.find({
        fromBookingDate: new Date(fromBookingDate),
        toBookingDate: new Date(toBookingDate),
      }); 

      if (!parcels.length) {
        return res.status(404).json({ message: "No parcels found!" });
      }
     
      if (parcels.length === 0) {
        return res.status(404).json({ message: "No Parcel dates found in the given date range!" });
      }
  
      res.status(200).json(parcels);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
    
export default { createParcel,
     getParcelById,
      getAllParcels, 
      getParcelLoadingDates,
      getParcelVocherNoUnique,
      updateParcel, 
      deleteParcel,
      getParcelsByFilter,
      branchToBranchLoading ,
      updateAllGrnNumbers,
      getParcelByLrNumber,
      getParcelByVehicalNumber,
      getParcelsByBranch,
      getParcelLoadingBetweenDates
    };
 