import {User,Booking} from "../models/booking.model.js";
import Branch from "../models/branch.model.js";
import ParcelLoading from '../models/pracel.loading.model.js'
import moment from "moment";
   
const generateGrnNumber = async () => {
  const lastBooking = await Booking.findOne().sort({ createdAt: -1 });
  return lastBooking ? lastBooking.grnNo + 1 : 1000;
};
 
const generateLrNumber = async (fromCity, location) => {
  try {
    const city = fromCity.substring(0, 1).toUpperCase(); // "H" for Hyderabad
    const locat = location.substring(0, 2).toUpperCase(); // "SR" for SR Nagar
    const companyName = "SK";
 
    const grnNumber = await generateGrnNumber(); // Global increment
 
    // Get current month & year in MMYY format
    const currentMonthYear = moment().format("MMYY"); // "0225" for Feb 2025
 
    // Find last LR number for the current month
    const lastBooking = await Booking.findOne({
      lrNumber: new RegExp(`^${companyName}${city}${locat}/\\d{4}/\\d{4}$`)
    }).sort({ createdAt: -1 });
 
    let sequenceNumber = 1; // Default start for new month
 
    if (lastBooking) {
      const lastLrNumber = lastBooking.lrNumber;
      const lastSequence = parseInt(lastLrNumber.split("/")[1], 10); // Extract 0001
      sequenceNumber = lastSequence + 1;
    }
 
    // Format sequence (0001, 0002, 0003...)
    const formattedSequence = String(sequenceNumber).padStart(4, "0");
 
    // Format GRN number (always increasing globally)
    const formattedGrn = String(grnNumber).padStart(4, "0");
 
    // Final LR format: "SKHSR/0001/1009"
    return `${companyName}${city}${locat}/${formattedSequence}/${formattedGrn}`;
  } catch (error) {
    throw new Error("Failed to generate LR number");
  }
};
 
const generateEWayBillNo = async () => {
  try {
    const today = moment().format("DDMMYYYY"); // Today's date in "06032025" format
 
    // Find the last booking for today
    const lastBooking = await Booking.findOne({
      eWayBillNo: new RegExp(`^EWB\\d{2}${today}$`) // Match today's eWayBillNo
    }).sort({ createdAt: -1 });
 
    let sequenceNumber = 1; // Start with 01 if no previous booking today
 
    if (lastBooking) {
      const lastEWayBillNo = lastBooking.eWayBillNo;
      const lastSequence = parseInt(lastEWayBillNo.substring(3, 5), 10); // Extract "01" from "EWB0106032025"
      sequenceNumber = lastSequence + 1;
    }
 
    // Format sequence (01, 02, 03...)
    const formattedSequence = String(sequenceNumber).padStart(2, "0");
 
    return `EWB${formattedSequence}${today}`;
  } catch (error) {
    throw new Error("Failed to generate eWayBillNo");
  }
};  
 
 
const generateReceiptNumber = async () => {
  const lastBooking = await Booking.findOne().sort({ receiptNo: -1 }).lean();
  return (lastBooking?.receiptNo || 0) + 1; // If no booking exists, start from 1
};
 
const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>&'"]/g, '');
  }
  return input;
};
 
const createBooking = async (req, res) => {
  try {
    // console.log(req.user)
    if (!req.user) {
     
      return res.status(401).json({ success: false, message: "Unauthorized: User data missing" });
    }
 
    const {
      fromCity, toCity, pickUpBranch, dropBranch, totalPrice, dispatchType, bookingType,
      packages, senderName, senderMobile, senderAddress, senderGst,
      receiverName, receiverMobile, receiverAddress, receiverGst, parcelGstAmount,vehicalNumber,
      serviceCharge = 0, hamaliCharge = 0, doorDeliveryCharge = 0, doorPickupCharge = 0, valueOfGoods = 0, items
    } = Object.fromEntries(
      Object.entries(req.body).map(([key, value]) => [key, sanitizeInput(value)])
    );
 
   
    if (!fromCity || !toCity || !pickUpBranch || !dropBranch || !dispatchType || !bookingType) {
      return res.status(400).json({ success: false, message: 'Missing required booking fields' });
    }
 
    //Validate package details
    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ success: false, message: "At least one package is required" });
    }
 
    for (const pkg of packages) {
      if (!pkg.quantity || !pkg.packageType || !pkg.weight || !pkg.unitPrice) {
        return res.status(400).json({ success: false, message: "Each package must have quantity, packageType, weight, and unitPrice" });
      }
    }
    for (const { quantity, packageType, weight, unitPrice } of packages) {
      if (!Number.isInteger(quantity) || quantity < 1 || !packageType || !weight || !unitPrice) {
        return res.status(400).json({ success: false, message: 'Each package must have valid quantity, packageType, weight, and unitPrice' });
      }
    }
    if (!senderName || !senderMobile || !senderAddress || !receiverName || !receiverMobile || !receiverAddress) {
      return res.status(400).json({ success: false, message: 'Sender and receiver details are required' });
    }
 
    if (![senderMobile, receiverMobile].every(m => /^\d{10}$/.test(m))) {
      return res.status(400).json({ success: false, message: 'Mobile numbers must be 10 digits' });
    }
    const [pickUpBranchdata, dropBranchdata] = await Promise.all([
      Branch.findOne({ branchUniqueId: pickUpBranch }).lean(),
      Branch.findOne({ branchUniqueId: dropBranch }).lean(),
    ]);
 
    if (!pickUpBranchdata || !dropBranchdata) {
      return res.status(404).json({ message: "Invalid branch provided" });
    }
    const pickUpBranchname = pickUpBranchdata.name;
    const dropBranchname = dropBranchdata.name;
 
    const location = req.user.location;
    console.log("location", location);
    const bookedBy = req.user.id;
    const bookingStatus=0;
    const adminUniqueId = req.user.subadminUniqueId;
    const bookbranchid= req.user.branchId;
 
 
    // Generate unique numbers
    // const grnNo = await generateGrnNumber();
    // const lrNumber = await generateLrNumber(fromCity, location);
    // const eWayBillNo = await generateEWayBillNo();
    // const generatedReceiptNo = await generateReceiptNumber();
    const [grnNo, lrNumber, eWayBillNo, generatedReceiptNo] = await Promise.all([
      generateGrnNumber(),
      generateLrNumber(fromCity, location),
      generateEWayBillNo(),
      generateReceiptNumber()
    ]);
 
    //  Calculate `totalQuantity` from `packages`
    const totalQuantity = packages.reduce((sum, pkg) => sum + Number(pkg.quantity), 0);
 
    //  Calculate Grand Total
    let packageTotal = packages.reduce((sum, pkg) => sum + Number(pkg.unitPrice) * Number(pkg.quantity), 0);
    let grandTotal = Number(packageTotal) + Number(serviceCharge) + Number(hamaliCharge) + Number(doorDeliveryCharge) + Number(doorPickupCharge) + Number(valueOfGoods);
 
    //  Create new booking object
    const booking = new Booking({
      grnNo,
      lrNumber,
      location,
      adminUniqueId,
      bookingTime: Date.now(),
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      dispatchType,
      bookingType,
      packages,  
      totalQuantity,  // Auto-filled field
      senderName,
      senderMobile,  
      senderAddress,
      senderGst,
      receiverName,
      receiverMobile,
      receiverAddress,
      receiverGst,
      parcelGstAmount,
      receiptNo: generatedReceiptNo,
      totalPrice,
      grandTotal,
      serviceCharge,
      hamaliCharge,
      doorDeliveryCharge,
      doorPickupCharge,
      valueOfGoods,
      bookingStatus,
      bookedBy,
      items,
      eWayBillNo,
      vehicalNumber,
      bookingDate: new Date(),bookbranchid,pickUpBranchname,dropBranchname
    });
 
    const savedBooking = await booking.save();
 
    if (savedBooking) {
      await Promise.all([
        (async () => {
          const senderExists = await User.findOne({ phone: senderMobile });
          if (!senderExists) {
            await User.create({ name: senderName, phone: senderMobile, address: senderAddress, gst: senderGst });
          }
        })(),
        (async () => {
          const receiverExists = await User.findOne({ phone: receiverMobile });
          if (!receiverExists) {
            await User.create({ name: receiverName, phone: receiverMobile, address: receiverAddress, gst: receiverGst });
          }
        })(),
      ]);
    }
   
 
    res.status(201).json({ success: true, message: "Booking created successfully", data: booking });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ error: error.message });
  }
};
 
const getAllBookings = async (req, res) => {
  try {
    // Extract pagination parameters from query (default to page 1, limit 10)
    const page = Math.max(1, parseInt(req.query.page, 10)) || 1; // Ensure page >= 1
    const limit = Math.max(1, parseInt(req.query.limit, 10)) || 10; // Ensure limit >= 1
    const skip = (page - 1) * limit; // Calculate documents to skip
 
    // Fetch total count and bookings in parallel
    const [totalBookings, bookings] = await Promise.all([
      Booking.countDocuments(), // Total number of bookings
      Booking.find()
        .skip(skip) // Skip documents for pagination
        .limit(limit) // Limit documents per page
        .lean(), // Return plain JS objects for speed
    ]);
 
    // Check if bookings exist
    if (!bookings.length && totalBookings > 0) {
      return res.status(404).json({
        success: false,
        message: `No bookings found for page ${page}`,
      });
    }
    if (totalBookings === 0) {
      return res.status(404).json({
        success: false,
        message: 'No bookings found',
      });
    }
 
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalBookings / limit);
 
    // Response with data and metadata
    return res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        currentPage: page,
        itemsPerPage: limit,
        totalItems: totalBookings,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
}

const getAllUsers = async (req, res) => {
  try {  
    const users = await User.find()
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "No Users found" });
    }
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
const cityWiseBookings = async (req, res) => {
  try {
    const {fromCity,toCity, startDate, endDate } = req.body;
 
    if (!fromCity || !toCity || !startDate || !endDate) {
      return res.status(400).json({ success: false, message: "fromCity toCity start date and end date are required" });
    }
 
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Ensure full day is included
 
    const bookings = await Booking.find({
      bookingDate: { $gte: start, $lte: end },
      fromCity,
      toCity
    });
 
    if (bookings.length === 0) {
      return res.status(404).json({ success: false, message: "No bookings found" });
    }
 
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};  
 
 
 
const getAllBookingsPages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default: Page 1
    const limit = parseInt(req.query.limit) || 10; // Default: 10 records per page
    const skip = (page - 1) * limit; // Calculate records to skip
 
    const totalBookings = await Booking.countDocuments();
    const totalPages = Math.ceil(totalBookings / limit);
 
    const bookings = await Booking.find()
      .populate("bookedBy")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
 
    if (bookings.length === 0) {
      return res.status(404).json({ success: false, message: "No bookings found" });
    }
 
    //  Calculate next & previous pages
    const nextPage = page < totalPages ? page + 1 : null;
    const prevPage = page > 1 ? page - 1 : null;
 
    //  Send response with pagination metadata
    res.status(200).json({
      success: true,
      page,
      limit,
      totalPages,
      totalBookings,
      nextPage,
      prevPage,
      bookings
    });
 
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
 
  const getBookingByGrnNo = async (req, res) => {
    try {
      const { grnNo } = req.params;
 
      if (!grnNo) {
        return res.status(400).json({ success: false, message: "grnNumber is required" });
      }
 
      const booking = await Booking.findOne({ grnNo });
 
      if (!booking) {
        return res.status(404).json({ success: false, message: "Booking not found" });
      }
 
      res.status(200).json(booking);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  };
 
  const getBookingadminUniqueId=async(req,res) => {
    try{
     const {adminUniqueId}=req.params
     const booking=await Booking.find({adminUniqueId}).populate("bookedBy",'name email role  username phone branchName branchId ')
     if(!booking){
      return res.status(404).json({message:"No adminUniqueId bookings !"})
     }
     res.status(200).json(booking)
    }
    catch(error){
      res.status(500).json({error:error.message})
    }
  }
 
 
  const getBookinglrNumber = async (req, res) => {
    try {
      const { lrNumber } = req.body;
     
      const booking = await Booking.findOne({ lrNumber });
      
      if (!booking) {
        return res.status(404).json({ message: "No bookings found for this lrNumber!" });
      }
 
      res.status(200).json(booking);
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ error: error.message });
    }
  };
 
  const deleteBookings=async(req,res) =>{
     try{
       const {id}=req.params
       const booking=await Booking.findByIdAndDelete(id)
       if(!booking){
        return res.status(400).json({message:"no bookings in this id"})
       }
       res.status(200).json({message:"booking deleted successfully"})
     }
 
     catch(error){
      res.status(500).json({error:error.message})
     }
  }
 
  const updateBookings=async(req,res) => {
    try{
      const {id} = req.params
      const update=req.body
 
      const booking=await Booking.findByIdAndUpdate(id,update,{new:true,runValidators:true})
      if(!booking){
        return res.status(404).json({message:"booking not found !"})
      }
      res.status(200).json({message:"successfully update booking",booking})
 
    }
    catch(error){
      res.status(500).json({error:error.message})
    }
  }
   
  const updateGRNBookings = async (req, res) => {
    try {
      const { grnNoUnique } = req.params;
      const update = req.body;
 
      const booking = await Booking.findOneAndUpdate(
        { grnNoUnique },
        update,
        { new: true, runValidators: true }
      );
 
      if (!booking) {
        return res.status(404).json({ message: "Booking not found!" });
      }
 
      res.status(200).json({ message: "Successfully updated booking", booking });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
 
const getBookingsfromCityTotoCity=async(req,res) => {
  try{
   const {fromCity,toCity}=req.params
 
   if(!fromCity || !toCity ){
    return res.status(400).json({message:"Required fields are missing !"})
   }
   const booking=await Booking.find({fromCity,toCity})
   if(!booking){
    return res.status(404).json({message:"bookings not found !"})
   }
   res.status(200).json(booking)
  }
  catch(error){
  res.status(500).json({error:error.message})
  }
}
 
const getBookingsBetweenDates = async (req, res) => {
  try {
    const { startDate, endDate, fromCity, toCity, pickUpBranch } = req.body;
 
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "Start date and end date are required!" });
    }
 
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
 
    let filter = { bookingDate: { $gte: start, $lte: end }, bookingStatus: 0 };
 
    if (fromCity) filter.fromCity = new RegExp(`^${fromCity}$`, "i");
 
    if (Array.isArray(toCity) && toCity.length > 0) {
      filter.toCity = { $in: toCity.map(city => new RegExp(`^${city}$`, "i")) };
    } else if (toCity) {
      filter.toCity = new RegExp(`^${toCity}$`, "i");
    }
 
    if (pickUpBranch) filter.pickUpBranch = pickUpBranch;
 
    const bookings = await Booking.find(filter);
 
    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found for the given filters!", data: [] });
    }
 
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
 
const getBookingsByAnyField = async (req, res) => {
  try {
    const { query } = req.query; // Use 'query' as the search input
 
    if (!query) {
      return res.status(400).json({ success: false, message: "Query parameter is required" });
    }
 
    const searchRegex = new RegExp(query, "i"); // Case-insensitive search
 
    const bookings = await Booking.find({
      $or: [
        { senderName: searchRegex },
        { receiverName: searchRegex },
        { pickUpBranch: searchRegex },
        {senderGst:searchRegex},
        {receiverGst:searchRegex},
        { senderMobile: isNaN(query) ? null : Number(query) },
        { receiverMobile: isNaN(query) ? null : Number(query) }
      ]
    });
 
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
 
//by sudheer
 
const getBookingBydate = async (req, res) => {
  try {
    // Ensure req.user exists
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Unauthorized: User data missing" });
    }
 
    const branchId = req.user?.branchId;
    if (!branchId) {
      return res.status(400).json({ success: false, message: "Branch ID is missing in the token" });
    }
 
    // Get today's start and end time (UTC for consistency)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
 
    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);
 
    // Find bookings by branchId and date
    const bookings = await Booking.find({
      bookbranchid: branchId,
      bookingTime: { $gte: startOfDay, $lte: endOfDay }
    });
 
    if (!bookings.length) {
      return res.status(404).json({ success: false, message: "No bookings found for today" });
    }
 
    res.status(200).json({ success: true, bookings });
  } catch (error) {
    console.error("Error in getBookingBydate:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
 
 
const getUsersBySearch = async (req, res) => {
  try {
    const { query } = req.query; // Get search query from request query parameters

    if (!query) {
      return res.status(400).json({ message: "Search query is required!" });
    }

    // Perform case-insensitive search using regex
    const users = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { address: { $regex: query, $options: "i" } },
        { gst: { $regex: query, $options: "i" } }
      ]
    });

    if (!users.length) {
      return res.status(404).json({ message: "No users found!" });
    }

    // Extract only required fields
    const responseData = users.map(user => ({
      name: user.name,
      phone: user.phone,
      address: user.address,
      gst: user.gst,
    
    }));

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const receivedBooking = async (req, res) => {
  try {
    const { grnNo } = req.body;
    const name = req.user?.name; // Ensure req.user is properly populated

    if (!grnNo) {
      return res.status(400).json({ message: "grnNo is required!" });
    }

    if (!name) {
      return res.status(400).json({ message: "Delivery employee name is required!" });
    }

    // Find the booking first
    const booking = await Booking.findOne({ grnNo });

    if (!booking) {
      return res.status(404).json({ message: "Booking not found!" });
    }

    // Check if the parcel is already received
    if (booking.bookingStatus === 4) {
      return res.status(400).json({ message: "Parcel already received!" });
    }

    // Update the booking if not already received
    booking.bookingStatus = 4;
    booking.deliveryDate = new Date();
    booking.deliveryEmployee = name;

    await booking.save({ validateModifiedOnly: true });

    return res.status(200).json({ message: "Booking received successfully", booking });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


const cancelBooking = async (req, res) => {
  try {
    const { grnNo } = req.params; 
    const { refundCharge, refundAmount, additionalField } = req.body; 

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { name, branch, city } = req.user; 

   
    const booking = await Booking.findOne({ grnNo });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.bookingStatus === 4) {
      return res.status(400).json({ message: "Booking cannot be cancelled. Parcel already received." });
    }

    // Update cancellation details
    booking.bookingStatus = 5; // Assuming '5' represents 'Cancelled'
    booking.cancelByUser = name;
    booking.cancelBranch = branch;
    booking.cancelCity = city;
    booking.cancelDate = new Date();

    // Update refund details
    if (refundCharge !== undefined) {
      booking.refundCharge = refundCharge;
    }
    if (refundAmount !== undefined) {
      booking.refundAmount = refundAmount;
    }
    if (additionalField !== undefined) {
      booking.additionalField = additionalField; // Update the third field
    }

    // Save without validation to avoid required field errors
    await booking.save({ validateBeforeSave: false });

    res.status(200).json({ message: "Booking cancelled successfully", booking });
  } catch (error) {
    console.error("Error cancelling booking:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};




// all booking reports 

const parcelBookingReports = async (req, res) => {
  try {
      let { fromDate, toDate, fromCity, toCity, bookingStatus, bookingType } = req.body;

      // Construct filter query
      let query = {};

      if (fromDate && toDate) {
          query.bookingDate = { 
              $gte: new Date(fromDate), 
              $lte: new Date(toDate) 
          };
      }

      if (fromCity) query.fromCity = fromCity;
      if (toCity) query.toCity = toCity;
      if (bookingStatus) query.bookingStatus = Number(bookingStatus);
      if (bookingType) query.bookingType = bookingType;

      const bookings = await Booking.find(query).sort({ bookingDate: -1 });

      if (bookings.length === 0) {
        return res.status(404).json({ message: "No parcels found" });
    }


      res.status(200).json(bookings);
  } catch (error) {
      res.status(500).json({ success: false, message: "Error fetching bookings", error: error.message });
  }
};

const allParcelBookingReport = async (req, res) => {
  try {
    const {
      startDate,
      fromDate,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      bookingStatus,
      vehicalNumber, // Corrected to match your model
    } = req.body;

    let query = {};

    // Date range filtering
    if (startDate && fromDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(startDate + "T23:59:59.999Z"),
      };
    }

    // Case-insensitive matching
    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, "i") };
    if (pickUpBranch) query.pickUpBranch = { $regex: new RegExp(pickUpBranch, "i") };
    if (dropBranch) query.dropBranch = { $regex: new RegExp(dropBranch, "i") };
    if (bookingStatus) query.bookingStatus = Number(bookingStatus);
    if (vehicalNumber) query.vehicalNumber = { $regex: new RegExp(vehicalNumber, "i") }; // Corrected field name

    const bookings = await Booking.find(query);
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const parcelReportSerialNo = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity } = req.body;

    let query = {};

    // Date range filtering
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // Case-insensitive search for cities
    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, "i") };

    // Fetch data from the Booking collection
    const bookings = await Booking.find(query).sort({ bookingDate: 1 });


    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const parcelCancelReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, bookingType } = req.body;

    let query = { bookingStatus: 5 }; // Fetch only canceled bookings

    // Date range filtering
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // Case-insensitive search for cities
    if (fromCity) query.fromCity = { $regex: new RegExp(fromCity, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(toCity, "i") };

    // Filter by booking type if provided
    if (bookingType) query.bookingType = { $regex: new RegExp(bookingType, "i") };

    

    // Fetch data from the Booking collection
    const bookings = await Booking.find(query).sort({ bookingDate: 1 });


    if (bookings.length === 0) {
      return res.status(200).json({ success: true, message: "No customer bookings found." });
    }
    
    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching canceled bookings:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const parcelBookingSummaryReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

    let query = {};

    // Filter by date range
    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    // Filter by fromCity and toCity
    if (fromCity) query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
    if (toCity) query.toCity = { $regex: new RegExp(`^${toCity}$`, "i") };

    // Filter by pickup and drop branches
    if (pickUpBranch) query.pickUpBranch = { $regex: new RegExp(`^${pickUpBranch}$`, "i") };
    if (dropBranch) query.dropBranch = { $regex: new RegExp(`^${dropBranch}$`, "i") };

    // Fetch data from the database
    const bookings = await Booking.find(query);

    
    if (bookings.length === 0) {
      return res.status(200).json({ success: true, message: "No customer bookings found." });
    }

    res.status(200).json(bookings);
  } catch (error) {
    console.error("Error fetching parcel booking summary report:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const parcelBookingMobileNumber = async (req, res) => {
  try {
    const { fromDate, toDate, senderMobile, receiverMobile, bookingType, bookingStatus } = req.body;

    let query = {};

    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    if (senderMobile) query.senderMobile = senderMobile;
    if (receiverMobile) query.receiverMobile = receiverMobile;
    if (bookingType) query.bookingType = bookingType;
    if (bookingStatus) query.bookingStatus = parseInt(bookingStatus);

    const bookings = await Booking.find(query);

    
    if (bookings.length === 0) {
      return res.status(200).json({ success: true, message: "No  bookings found." });
    }

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const regularCustomerBooking = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

    let query = {};

    if (fromDate && toDate) {
      query.bookingDate = {
        $gte: new Date(fromDate + "T00:00:00.000Z"),
        $lte: new Date(toDate + "T23:59:59.999Z"),
      };
    }

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    const bookings = await Booking.find(query);

    
    if (bookings.length === 0) {
      return res.status(200).json({ success: true, message: "No customer bookings found." });
    }

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const branchWiseCollectionReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, pickUpBranch, bookedBy } = req.body;  

    // Validate required query parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required" });
    }

    // Convert string dates to JavaScript Date objects
    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999); // Ensure the full day is included

    // Create a filter object for MongoDB query
    let filter = {
      bookingDate: { $gte: start, $lte: end }, // Filter by bookingDate range
    };

    if (fromCity) filter.fromCity = fromCity;
    if (pickUpBranch) filter.pickUpBranch = pickUpBranch;
    if (bookedBy) filter.bookedBy = bookedBy;

    // Fetch data from MongoDB collection
    const reportData = await Booking.find(filter);

    if (reportData.length === 0) {
      return res.status(404).json({ message: "No bookings found." });
    }
    

    // Send response
    res.status(200).json(reportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


const parcelBranchConsolidatedReport = async (req, res) => {
  try {
    const { fromDate, toDate, pickUpBranch, fromCity, bookedBy, filter: bookingStatus } = req.body;
    
    // Validate required fields
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: "fromDate and toDate are required." });
    }

    // Convert dates to JavaScript Date objects
    const start = new Date(fromDate);
    const end = new Date(toDate);
    
    if (end < start) {
      return res.status(400).json({ error: "toDate must be greater than or equal to fromDate." });
    }

    end.setHours(23, 59, 59, 999); // Ensure full-day inclusion

    // Build the filter object for all bookings
    let filters = { bookingDate: { $gte: start, $lte: end } };

    if (pickUpBranch) filters.pickUpBranch = pickUpBranch;
    if (fromCity) filters.fromCity = fromCity;
    if (bookedBy) filters.bookedBy = bookedBy;
    if (bookingStatus !== undefined) filters.bookingStatus = bookingStatus;

    // Fetch all bookings matching the filters
    const reportData = await Booking.find(filters);

    // Get total count of bookings
    const totalBookings = reportData.length;

    // Fetch count of canceled bookings (bookingStatus = 5)
    const canceledBookings = await Booking.countDocuments({ ...filters, bookingStatus: 5 });

    // Check if any records exist
    if (totalBookings === 0) {
      return res.status(404).json({ 
        message: "No bookings found for the given criteria.", 
        totalBookings: 0, 
        canceledBookings: 0 
      });
    }

    // Return response with total and canceled bookings
    res.status(200).json({
      totalBookings,
      canceledBookings,
      bookings: reportData
    });
  } catch (error) {
    console.error("Error fetching parcel branch consolidated report:", error);
    res.status(500).json({ error: "Internal server error." });
  }
};

// gst report

const parcelBranchWiseGSTReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, pickUpBranch } = req.body;

    let query = {
      $or: [
        { bookingType: "paid", bookingStatus: { $in: [0, 1, 2] } },
        { bookingType: "toPay", bookingStatus: { $in: [0, 1, 2, 4] } }, // Include 4 only for 'toPay'
        {bookingType: "Credit", bookingStatus:{$in:[5]}}
      ],
    };

    if (fromDate && toDate) {
      query.bookingDate = { 
        $gte: new Date(fromDate + "T00:00:00.000Z"), 
        $lte: new Date(toDate + "T23:59:59.999Z") 
      };
    }

    if (fromCity) {
      query.fromCity = { $regex: new RegExp(`^${fromCity}$`, "i") };
    }

    if (pickUpBranch) {
      query.pickUpBranch = { $regex: new RegExp(`^${pickUpBranch}$`, "i") };
    }

    const bookings = await Booking.find(query);

    if (bookings.length === 0) {
      return res.status(404).json({ success: false, message: "No bookings found" });
    }

    // Calculate total parcels and total GST amount
    const totalParcel = bookings.length;
    const parcelGstAmount = bookings.reduce((sum, booking) => sum + (booking.parcelGstAmount || 0), 0);

    console.log("Total Bookings:", totalParcel);
    console.log("Total Parcel GST Amount:", parcelGstAmount);

    res.status(200).json({
      success: true,
      totalParcel,
      parcelGstAmount,
      bookings,
    });
  } catch (error) {
    console.error("Error fetching GST report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



export default {createBooking,
  getAllBookings,
  getBookingByGrnNo,
  deleteBookings,
  updateBookings,
  getBookingadminUniqueId,
  updateGRNBookings,
  getBookinglrNumber,
  updateAllGrnNumbers,
  getBookingsfromCityTotoCity,
  getBookingsBetweenDates,
  getAllBookingsPages,
  getBookingsByAnyField,
  cityWiseBookings,
  getAllUsers,
  getUsersBySearch,
  getBookingBydate,
  receivedBooking,
  cancelBooking,

// Reports  

parcelBookingReports,
allParcelBookingReport,
parcelReportSerialNo,
parcelCancelReport,
parcelBookingSummaryReport,
parcelBookingMobileNumber,
regularCustomerBooking,
branchWiseCollectionReport,
parcelBranchConsolidatedReport,
parcelBranchWiseGSTReport
}
 
 