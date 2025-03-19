import ParcelLoading from "../models/pracel.loading.model.js";
import Booking from '../models/booking.model.js'


const generateVocherNoUnique=()=>{
    return Math.floor(100000+Math.random()*900000)
}


const createParcel = async (req, res) => {
    const session = await ParcelLoading.startSession(); // Start a transaction session
    session.startTransaction();

    try {
        const {
            fromBranch, toBranch, loadingDate, parcelStatus, vehicalNumber,
            driverName, driverNo, fromBookingDate, toBookingDate,
            fromCity, toCity, remarks, grnNo, lrNumber  
        } = req.body;

        //  Validate required fields
        if (!fromBranch || !vehicalNumber || !driverName || !driverNo ||
            !fromBookingDate || !toBookingDate || !fromCity || !toCity || 
            !Array.isArray(grnNo) || grnNo.length === 0 || !Array.isArray(lrNumber) || lrNumber.length === 0) {
            return res.status(400).json({ message: "All required fields must be provided" });
        }

        //  Ensure that GRN numbers exist in Booking collection before proceeding
        const existingBookings = await Booking.find({ grnNo: { $in: grnNo } }).session(session);
        if (existingBookings.length === 0) {
            throw new Error("No matching GRN numbers found in Booking collection.");
        }

        const vocherNoUnique = generateVocherNoUnique();   
        const loadingBy = req.user.id;

        // Create the parcel record
        const parcel = await new ParcelLoading({
            parcelType,
            vehicalNumber,
            parcelStatus,
            loadingBy,
            vocherNoUnique,
            fromBranch,
            toBranch,
            loadingDate,   
            driverName,
            driverNo,
            fromBookingDate,
            toBookingDate,
            fromCity,
            toCity,
            remarks,
            grnNo,
            lrNumber
        }).save({ session });

        //  Update all bookings in a single query
        const updateResult = await Booking.updateMany(
            { grnNo: { $in: grnNo } }, 
            { 
                $set: { 
                    bookingStatus: "1",
                    loadingDate: loadingDate
                }
            },
            { session }
        );

        console.log("Updated Bookings:", updateResult.modifiedCount);

        await session.commitTransaction(); //  Commit transaction
        res.status(201).json({ message: "Parcel created successfully and bookings updated", parcel });
    } catch (error) {
        if (session.inTransaction()) { 
            await session.abortTransaction(); //  Abort transaction only if active
        }
        console.error("Error creating parcel:", error);
        res.status(500).json({ message: "Internal Server Error", error: error.message });
    } finally {
        session.endSession(); // Always end session
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
        const { fromBookingDate, toBookingDate, fromCity, toCity } = req.body;

        if (!fromBookingDate || !toBookingDate || !fromCity || !toCity) {
            return res.status(400).json({ success: false, message: "Required fields are missing" });
        }

        const start = new Date(fromBookingDate);
        const end = new Date(toBookingDate);
        end.setHours(23, 59, 59, 999); // Ensure the full day is included

        let query = {
            fromBookingDate: { $gte: start },
            toBookingDate: { $lte: end },
            fromCity
        };

        // If toCity is an array, use $in to match at least one city
        if (Array.isArray(toCity) && toCity.length > 0) {
            query.toCity = { $in: toCity };
        } else {
            query.toCity = toCity; // Single city case
        }

        const parcels = await ParcelLoading.find(query);

        if (parcels.length === 0) {
            return res.status(404).json({ success: false, message: "No parcels found" });
        }

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};



const branchToBranchLoading = async (req, res) => {
    try {
        const { fromBookingDate, toBookingDate, fromBranch } = req.body;

        // Build the query object dynamically
        let query = {};

        if (fromBookingDate && toBookingDate) {
            query.fromBookingDate = { $gte: new Date(fromBookingDate), $lte: new Date(toBookingDate) };
        } else if (fromBookingDate) {
            query.fromBookingDate = { $gte: new Date(fromBookingDate) };
        } else if (toBookingDate) {
            query.toBookingDate = { $lte: new Date(toBookingDate) };
        }

        if (fromBranch) query.fromBranch = fromBranch; // Fix field name

        // Fetch parcels based on query
        const parcels = await ParcelLoading.find(query);

        if (!parcels.length) return res.status(404).json({ message: "No parcels found" });

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
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

        // Fetch parcels where lrNumber matches
        const parcels = await ParcelLoading.find({ lrNumber: { $in: lrNumber } });

        // Fetch booking data separately
        const bookings = await Booking.find({ lrNumber: { $in: lrNumber } });

        if (parcels.length === 0 && bookings.length === 0) {
            return res.status(404).json({ message: "No matching data found" });
        }

        res.status(200).json({ parcels, bookings });
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

const getParcelByGrnNo = async (req, res) => {
    try {
        const { grnNo } = req.body;

        if (!grnNo) {
            return res.status(400).json({ message: "grnNo is required" });
        }

        // Fetch parcel where grnNo matches
        const parcel = await ParcelLoading.findOne({ grnNo: grnNo });

        // Fetch booking data separately
        const booking = await Booking.findOne({ grnNumber: grnNo});
    
        if (!parcel && !booking) {
            return res.status(404).json({ message: "No matching data found" });
        }

        res.status(200).json({ parcel, booking });
    } catch (error) {
        res.status(500).json({error: error.message });
    }
};
      
const getParcelByVehicalNumber = async (req, res) => {
    try {
        const { vehicalNumber } = req.params;

        const parcel = await ParcelLoading.find({vehicalNumber})

        if(parcel.length===0){
            return res.status(400).json({message:"parcel not found !"})
        }

        res.status(200).json(parcel);
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
  
      const startDate = new Date(fromBookingDate);
      const endDate = new Date(toBookingDate);
  
      if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ message: "Invalid date format!" });
      }
  
     
      endDate.setHours(23, 59, 59, 999);
  
      const parcels = await ParcelLoading.find({
        fromBookingDate: { $gte: startDate, $lte: endDate },
      });
  
      if (!parcels.length) {
        return res.status(404).json({ message: "No parcels found in the given date range!" });
      }
  
      res.status(200).json(parcels);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  };
  
  const getParcelsByFilters = async (req, res) => {
    try {
        const { fromBranch, fromCity, toCity, fromBookingDate, toBookingDate } = req.body;

        let query = {}; 

        if (fromBranch) query.fromBranch = fromBranch;
        if (fromCity) query.fromCity = fromCity;
        if (toCity) query.toCity = toCity;
        if (fromBookingDate) query.fromBookingDate = { $gte: new Date(fromBookingDate) };
        if (toBookingDate) query.toBookingDate = { $lte: new Date(toBookingDate) };

        const parcels = await ParcelLoading.find(query);

        if (parcels.length === 0) {
            return res.status(404).json({ message: "No parcels found" });
        }

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ message: "Server error", error: error.message });
    }
};
  

const parcelStatusReport = async (req, res) => {
    try {
        const { startDate, endDate, fromCity, toCity, parcelStatus } = req.body;

        if (!startDate || !endDate || !fromCity || !toCity || parcelStatus === undefined) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        // Ensure date filtering works properly
        const parcels = await ParcelLoading.find({
            fromCity,
            toCity,
            parcelStatus,
            fromBookingDate: { $gte: new Date(startDate) },
            toBookingDate: { $lte: new Date(endDate) },
        });

        if (parcels.length === 0) {
            return res.status(404).json({ message: "No parcels found" });
        }

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const parcelPendingReport = async (req, res) => {
    try {
        const { fromCity, toCity, fromBranch, toBranch } = req.body;

        if (!fromCity || !toCity || !fromBranch || !toBranch) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const pendingParcels = await ParcelLoading.find({
            fromCity,
            toCity,
            fromBranch,
            toBranch,
        });

        if (pendingParcels.length === 0) {
            return res.status(404).json({ success: false, message: "No pending parcels found" });
        }

        res.status(200).json(pendingParcels);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getParcelsInUnloading = async (req, res) => {
    try {    
        const { fromDate } = req.body;

        if (!fromDate) {
            return res.status(400).json({ message: "fromDate is required" });
        }

        // Convert fromDate to a date range for the entire day (00:00:00 - 23:59:59)
        const startOfDay = new Date(fromDate);
        startOfDay.setUTCHours(0, 0, 0, 0);

        const endOfDay = new Date(fromDate);
        endOfDay.setUTCHours(23, 59, 59, 999);

        // Filter only by date
        const filter = {
            fromBookingDate: { $gte: startOfDay, $lte: endOfDay }
        };

        // Fetch parcels
        const parcels = await ParcelLoading.find(filter);

        if (parcels.length === 0) {
            return res.status(404).json({ message: "No parcels found!" });
        }

        res.status(200).json(parcels);
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};


    
export default { createParcel,
     getParcelById,
      getAllParcels, 
      getParcelVocherNoUnique,
      updateParcel, 
      deleteParcel,
      getParcelsByFilter,
      branchToBranchLoading ,
      updateAllGrnNumbers,
      getParcelByLrNumber,
      getParcelByVehicalNumber,
      getParcelLoadingBetweenDates,
      getParcelsByFilters,
      parcelStatusReport,
      parcelPendingReport,
      getParcelsInUnloading,
      getParcelByGrnNo,
    };
 