import ParcelUnloading from '../models/parcel.unloading.model.js'

import {Booking} from '../models/booking.model.js'


// const getParcelsLoading = async (req, res) => {
//     try {
//         const { fromDate, toDate, fromCity, toCity, vehicalNumber, dropBranch } = req.body;

//         if (!fromDate || !toDate) {
//             return res.status(400).json({ message: "fromDate and toDate are required" });
//         }

//         let matchQuery = {
//             bookingStatus: 1, 
//             bookingDate: {
//                 $gte: new Date(fromDate + "T00:00:00.000Z"),
//                 $lte: new Date(toDate + "T23:59:59.999Z"),
//             },
//         };

//         if (fromCity) matchQuery.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
//         if (toCity) matchQuery.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };
//         if (dropBranch) matchQuery.dropBranch = { $regex: new RegExp(`^${dropBranch}$`, "i") };
//         if (vehicalNumber) matchQuery.vehicalNumber = { $regex: new RegExp(`^${vehicalNumber}$`, "i") };

//         const bookings = await Booking.aggregate([
//             { $match: matchQuery },
//             {
//                 $addFields: {
//                     totalQuantity: { $sum: "$packages.quantity" } // Calculate totalQuantity dynamically
//                 }
//             },
//             {
//                 $project: {
//                     grnNo: 1,
//                     fromCity: 1,
//                     toCity: 1,
//                     pickUpBranch: 1,
//                     dropBranch: 1,
//                     senderName: 1,
//                     receiverName: 1,
//                     bookingDate: 1,
//                     totalQuantity: 1, // Now calculated dynamically
//                     grandTotal: 1,
//                     _id: 0
//                 }
//             }
//         ]);

//         if (bookings.length === 0) {
//             return res.status(200).json({ success: true, message: "No customer bookings found with bookingStatus: 1." });
//         }

//         return res.status(200).json({ success: true, data: bookings });

//     } catch (error) {
//         console.error("Error fetching parcel booking summary report:", error);
//         res.status(500).json({ success: false, message: "Internal server error", error: error.message });
//     }
// };


const getParcelsLoading = async (req, res) => {
    try {
        const { fromDate, toDate, fromCity, toCity, vehicalNumber, dropBranch } = req.body;

        if (!fromDate || !toDate) {
            return res.status(400).json({ message: "fromDate and toDate are required" });
        }

        let matchQuery = {
            bookingStatus: 1,
            bookingDate: {
                $gte: new Date(fromDate + "T00:00:00.000Z"),
                $lte: new Date(toDate + "T23:59:59.999Z"),
            },
        };

        // Handle fromCity as string or array
        if (fromCity) {
            if (Array.isArray(fromCity) && fromCity.length > 0) {
                matchQuery.fromCity = {
                    $in: fromCity.map(city => new RegExp(`^${city}$`, 'i'))
                };
            } else if (typeof fromCity === 'string') {
                matchQuery.fromCity = { $regex: new RegExp(`^${fromCity}$`, 'i') };
            }
        }

        if (toCity) {
            matchQuery.toCity = { $regex: new RegExp(`^${toCity}$`, 'i') };
        }

        if (dropBranch) {
            matchQuery.dropBranch = { $regex: new RegExp(`^${dropBranch}$`, 'i') };
        }

        if (vehicalNumber) {
            matchQuery.vehicalNumber = { $regex: new RegExp(`^${vehicalNumber}$`, 'i') };
        }

        const bookings = await Booking.aggregate([
            { $match: matchQuery },
            {
                $addFields: {
                    totalQuantity: { $sum: "$packages.quantity" }
                }
            },
            {
                $group: {
                    _id: "$bookingType",
                    totalQuantity: { $sum: "$totalQuantity" },
                    totalGrandTotal: { $sum: "$grandTotal" },
                    bookings: { $push: "$$ROOT" }
                }
            },
            {
                $project: {
                    bookingType: "$_id",
                    totalQuantity: 1,
                    totalGrandTotal: 1,
                    bookings: {
                        grnNo: 1,
                        fromCity: 1,
                        toCity: 1,
                        lrNumber:1,
                        pickUpBranch: 1,
                        pickUpBranchname:1,
                        dropBranch: 1,
                        dropBranchname:1,
                        senderName: 1,
                        receiverName: 1,
                        bookingStatus: 1,
                        bookingDate: 1,
                        totalQuantity: 1,
                        grandTotal: 1
                    }
                }
            }
        ]);

        if (bookings.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No customer bookings found with bookingStatus: 1."
            });
        }

        return res.status(200).json({ success: true, data: bookings });

    } catch (error) {
        console.error("Error fetching parcel booking summary report:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const getParcelunLoadingByGrnNumber = async (req, res) => {
    try {
        const grnNo = Number(req.params.grnNo); // FIXED

        if (!grnNo) {
            return res.status(400).json({ message: "grnNo is required and must be a number" });
        }

        const booking = await Booking.aggregate([
            { $match: { grnNo, bookingStatus: 1 } }, // will now match properly
            {
                $addFields: {
                    totalQuantity: { $sum: "$packages.quantity" }
                }
            },
            {
                $group: {
                    _id: "$bookingType",
                    totalQuantity: { $sum: "$totalQuantity" },
                    totalGrandTotal: { $sum: "$grandTotal" },
                    bookings: { $push: "$$ROOT" }
                }
            },
            {
                $project: {
                    bookingType: "$_id",
                    totalQuantity: 1,
                    totalGrandTotal: 1,
                    bookings: {
                        $map: {
                            input: "$bookings",
                            as: "booking",
                            in: {
                                grnNo: "$$booking.grnNo",
                                fromCity: "$$booking.fromCity",
                                toCity: "$$booking.toCity",
                                pickUpBranch: "$$booking.pickUpBranch",
                                pickUpBranchname: "$$booking.pickUpBranchname",
                                dropBranch: "$$booking.dropBranch",
                                dropBranchname: "$$booking.dropBranchname",
                                senderName: "$$booking.senderName",
                                receiverName: "$$booking.receiverName",
                                bookingStatus: "$$booking.bookingStatus",
                                bookingDate: "$$booking.bookingDate",
                                totalQuantity: "$$booking.totalQuantity",
                                grandTotal: "$$booking.grandTotal"
                            }
                        }
                    }
                }
            }
        ]);

        if (!booking || booking.length === 0) {
            return res.status(404).json({ message: "Booking not found or doesn't match bookingStatus: 1" });
        }

        return res.status(200).json({
            success: true,
            data: booking
        });

    } catch (error) {
        console.error("Error in getParcelunLoadingByGrnNumber:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

  

const generateUnloadingVoucher = () => Math.floor(10000 + Math.random() * 90000);  

const createParcelUnloading = async (req, res) => {
    try {
        const {vehicalNumber,branch, lrNumber, grnNo, bookingType } = req.body;

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
            unLoadingBy,
            branch,
            vehicalNumber,
            lrNumber,
            grnNo: grnNumbers,
            bookingType,
            unloadingDate:new Date()
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