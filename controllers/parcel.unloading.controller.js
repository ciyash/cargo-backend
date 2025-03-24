import ParcelUnloading from '../models/parcel.unloading.model.js'
import {Booking} from '../models/booking.model.js'
import ParcelLoading from '../models/pracel.loading.model.js'
import Branch from '../models/branch.model.js'


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
        if (vehicalNumber) {
            filter.vehicalNumber = vehicalNumber;
        }

        // Fetch parcels based on filters
        const parcels = await ParcelLoading.find(filter);

        if (parcels.length === 0) {
            return res.status(404).json({ message: "No parcels found!" });
        }

        // Extract unique grnNo values from all parcels
        const grnNumbers = [...new Set(parcels.flatMap(parcel => parcel.grnNo))];

        // Fetch Booking data based on grnNo
        const bookingData = await Booking.aggregate([
            { $match: { grnNo: { $in: grnNumbers } } },
            {
                $group: {
                    _id: null,
                    totalQuantity: { $sum: "$totalQuantity" },
                    grandTotal: { $sum: "$grandTotal" },
                    bookingTypes: { $addToSet: "$bookingType" } // Collect unique booking types
                }
            }
        ]);

        // Default booking data if no matching bookings
        const bookingSummary = bookingData.length > 0 ? bookingData[0] : {
            totalQuantity: 0,
            grandTotal: 0,
            bookingTypes: []
        };

        // Fetch branch names based on branch codes in the request
        let branchMap = {};
        if (Array.isArray(branch) && branch.length > 0) {
            const branchData = await Branch.find({ branchCode: { $in: branch } });

            // Create a mapping of branchCode to branchName
            branchMap = branchData.reduce((map, branch) => {
                map[branch.branchCode] = branch.branchName;
                return map;
            }, {});
        }

        // Format response to include branch names
        res.status(200).json({
            parcels,
            totalQuantity: bookingSummary.totalQuantity,
            grandTotal: bookingSummary.grandTotal,
            bookingTypes: bookingSummary.bookingTypes,
            branchNames: branch.map(code => ({
                branchCode: code,
                branchName: branchMap[code] || code // Use code as fallback if name not found
            }))
        });
    } catch (error) {
        console.error("Error fetching parcels:", error);
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
        // console.error("Error creating parcel unloading:", error);
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
        // console.error("Error fetching parcels:", error);
        res.status(500).json({ error:error.message});
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


  const parcelBranchToBranchUnloading = async (req, res) => {
    try {
      const { fromLoadingDate, toLoadingDate, fromBranch, toBranch } = req.body;
  
      // Validate required fields
      if (!fromLoadingDate || !toLoadingDate || !fromBranch || !toBranch) {
        return res.status(400).json({
          success: false,
          message: "fromLoadingDate, toLoadingDate, fromBranch, and toBranch are required",
        });
      }
  
      // Convert "YYYY-MM-DD" to ISO Date format
      const fromDate = new Date(fromLoadingDate + "T00:00:00.000Z"); // Start of the day
      const toDate = new Date(toLoadingDate + "T23:59:59.999Z"); // End of the day
  
      // Fetch bookings within the loading date range and matching branches
      const bookings = await Booking.find({
        loadingDate: { $gte: fromDate, $lte: toDate },
        pickUpBranch: fromBranch,
        dropBranch: toBranch,
      }).lean();
  
      return res.status(200).json(bookings);
  
    } catch (error) {
      console.error("Error fetching bookings:", error);
      return res.status(500).json({ error:error.message });
    }
  };

  const parcelBranchToBranchUnloadingPost = async (req, res) => {
    try {
        const { fromDate, toDate, branch, lrNumber, grnNo,unloadBranch,remarks} = req.body;

        // console.log("User Data:", req.user); // Debugging Line to check user data

        if (!req.user || !req.user.branchCity || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized: User details are missing",
            });
        }

        const fromCity = req.user.branchCity;
        const toCity = req.user.branchCity;
        const unLoadingBy = req.user.id;

        if (!grnNo || !Array.isArray(grnNo) || grnNo.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "GRN numbers are required and should be an array" 
            });
        }

        if (!fromDate || !toDate || !branch || !lrNumber ) {
            return res.status(400).json({   
                success: false,
                message: "All required fields must be provided" 
            });
        }

        // Convert dates correctly
        const fromBookingDate = new Date(fromDate);
        const toBookingDate = new Date(toDate);

        if (isNaN(fromBookingDate) || isNaN(toBookingDate)) {
            return res.status(400).json({
                success: false,
                message: "Invalid date format. Use YYYY-MM-DD."
            });
        }

        const bookings = await Booking.find({
            grnNo: { $in: grnNo },
        });

        if (!bookings.length) {
            return res.status(404).json({
                message: "No bookings found for the provided GRN numbers"

            });
        }

        const parcel = new ParcelUnloading({
            unLoadingVoucher: generateUnloadingVoucher(),
            fromBookingDate,
            toBookingDate,
            unLoadingBy,
            fromCity,
            toCity,
            branch,
            lrNumber,
            grnNo,
            unloadBranch,
            remarks,
        });

        await parcel.save();

        return res.status(200).json({ 
            success: true, 
            message: "Parcel unloading recorded successfully",
            data: parcel 
        });

    } catch (error) {
        console.error("Error processing request:", error);
        return res.status(500).json({ error: error.message });
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
    getParcelsLoading,
    parcelBranchToBranchUnloading,
    parcelBranchToBranchUnloadingPost
}