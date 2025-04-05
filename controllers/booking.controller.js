import {User,Booking} from "../models/booking.model.js";
import Branch from "../models/branch.model.js";
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
      packages, senderName, senderMobile, senderAddress, senderGst,actulWeight,
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
    for (const { quantity, packageType, weight, unitPrice,actulWeight } of packages) {
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
      actulWeight,
      bookingDate: new Date(),
      bookbranchid,
      pickUpBranchname,
      dropBranchname
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
    const booking=await Booking.find()
    if(!booking){
      return res.status(404).json({message:"No data in bookings !"})
    }
    res.status(200).json(booking)
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

    // Validate required date parameters
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide required parameters: fromDate and toDate'
      });
    }

    // Enforce the condition: if fromCity is "all" or not provided, pickUpBranch must be "all" or not provided
    const isCityAll = !fromCity || fromCity.toLowerCase() === 'all';
    const isBranchAll = !pickUpBranch || pickUpBranch.toLowerCase() === 'all';

    if (isCityAll && !isBranchAll) {
      return res.status(400).json({
        success: false,
        message: 'When selecting all cities, Branch must be "select all" or omitted'
      });
    }

    // Convert dates
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);

    // // Log input for debugging
    // console.log('Request Body:', req.body);
    // console.log('Start Date:', startDate);
    // console.log('End Date:', endDate);

    // Build the initial $match query dynamically
    const matchQuery = {
      bookingDate: { $gte: startDate, $lte: endDate }
    };

    // Add fromCity to query only if provided and not "all"
    if (!isCityAll) {
      matchQuery.fromCity = { $regex: new RegExp(`^${fromCity}$`, 'i') }; // Case-insensitive
    }

    // Add pickUpBranch to query only if provided and not "all"
    if (!isBranchAll) {
      matchQuery.pickUpBranch = pickUpBranch;
    }

    // Log the constructed query
    // console.log('Match Query:', matchQuery);

    // Test the initial match stage
    const matchedDocs = await Booking.find(matchQuery).lean();
    // console.log('Matched Documents:', matchedDocs);

    // Perform aggregation
    const [result] = await Booking.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          bookingGST: [
            {
              $match: {
                bookingType: { $in: [/^pay$/i, /^topay$/i] },
                bookingStatus: { $in: [0, 1, 2] }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$parcelGstAmount' },
                count: { $sum: 1 }
              }
            }
          ],
          deliveryGST: [
            {
              $match: {
                bookingType: { $in: [/^pay$/i, /^topay$/i] },
                bookingStatus: 4
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$parcelGstAmount' },
                count: { $sum: 1 }
              }
            }
          ],
          creditGST: [
            {
              $match: {
                bookingType: { $regex: /^credit$/i },
                bookingStatus: { $in: [0, 1, 2, 4] }
              }
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$parcelGstAmount' },
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ]);

    // console.log('Aggregation Result:', result);

    const bookingGST = result?.bookingGST[0] ?? { total: 0, count: 0 };
    const deliveryGST = result?.deliveryGST[0] ?? { total: 0, count: 0 };
    const creditGST = result?.creditGST[0] ?? { total: 0, count: 0 };

    const totalGST = bookingGST.total + deliveryGST.total + creditGST.total;
    const totalBookings = bookingGST.count + deliveryGST.count + creditGST.count;

    res.status(200).json({
      success: true,
      data: {
        bookingGST: {
          amount: bookingGST.total,
          count: bookingGST.count 
        },
        deliveryGST: {
          amount: deliveryGST.total,
          count: deliveryGST.count 
        },
        creditGST: {
          amount: creditGST.total,
          count: creditGST.count 
        },
        totalGST,
        totalBookings,
        filters: { fromDate, toDate, fromCity: fromCity || 'all', pickUpBranch: pickUpBranch || 'all' }
      },
      message: 'GST breakdown calculated successfully'
    });
  } catch (error) {
    console.error('Error calculating GST breakdown:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};

const senderReceiverGSTReport = async (req, res) => {
  try {
    const { fromDate, toDate, branchCity, branchName } = req.body; 

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }

    
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999); 

    // Construct query object
    let query = {
      bookingDate: { $gte: startDate, $lte: endDate }
    };

    if (branchCity) query.fromCity = branchCity; // Add branchCity condition if provided
    if (branchName) query.pickUpBranch = branchName; // Add branchName condition if provided

    // Fetch bookings and return only required fields
    const bookings = await Booking.find(query).select(
      "grnNo bookingDate senderName receiverName bookingType ltDate senderGst reciverGst grandTotal parcelGstAmount"
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found for the given criteria" });
    }
    const totalParcelGst = bookings.reduce((sum, booking) => sum + (booking.parcelGstAmount || 0), 0);

    res.status(200).json({bookings,totalParcelGst});
  } catch (error) {
    res.status(500).json({ message:error.message});
  }
};

const getBranchCity = async (branchUniqueId) => {
  const branch = await Branch.findOne({ branchUniqueId }).lean();
  return branch ? branch.city : null;
};


const pendingDeliveryStockReport = async (req, res) => {
  try {
    const { fromCity, toCity, pickUpBranch, dropBranch } = req.body;

    // Validate "all" conditions
    const isFromCityAll = !fromCity || fromCity.toLowerCase() === 'all';
    const isToCityAll = !toCity || toCity.toLowerCase() === 'all';
    const isPickUpBranchAll = !pickUpBranch || pickUpBranch.toLowerCase() === 'all';
    const isDropBranchAll = !dropBranch || dropBranch.toLowerCase() === 'all';

    if (isFromCityAll && !isPickUpBranchAll) {
      return res.status(400).json({
        success: false,
        message: 'When fromCity is "all" or omitted, pickUpBranch must be "all" or omitted',
      });
    }
    if (isToCityAll && !isDropBranchAll) {
      return res.status(400).json({
        success: false,
        message: 'When toCity is "all" or omitted, dropBranch must be "all" or omitted',
      });
    }

    // Verify fromCity matches pickUpBranch city (if both provided)
    if (!isFromCityAll && !isPickUpBranchAll) {
      const pickUpBranchCity = await getBranchCity(pickUpBranch);
      if (!pickUpBranchCity) {
        return res.status(400).json({
          success: false,
          message: `PickUpBranch ${pickUpBranch} not found`,
        });
      }
      if (pickUpBranchCity.toLowerCase() !== fromCity.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: `fromCity (${fromCity}) does not match the city of pickUpBranch (${pickUpBranchCity})`,
        });
      }
    }

    // Verify toCity matches dropBranch city (if both provided)
    if (!isToCityAll && !isDropBranchAll) {
      const dropBranchCity = await getBranchCity(dropBranch);
      if (!dropBranchCity) {
        return res.status(400).json({
          message: `DropBranch ${dropBranch} not found`,
        });
      }
      if (dropBranchCity.toLowerCase() !== toCity.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: `toCity (${toCity}) does not match the city of dropBranch (${dropBranchCity})`,
        });
      }
    }

    // Build query for pending deliveries
    const query = {
      $or: [
        { bookingStatus: 2 },
        { deliveryDate: null },
      ],
    };

    if (!isFromCityAll) query.fromCity = fromCity;
    if (!isToCityAll) query.toCity = toCity;
    if (!isPickUpBranchAll) query.pickUpBranch = pickUpBranch;
    if (!isDropBranchAll) query.dropBranch = dropBranch;

    

    // Fetch raw booking data and count
    const bookings = await Booking.find(query).lean();
    const bookingRecords = bookings.length;
    

    // Aggregation pipeline for totals
    const [result] = await Booking.aggregate([
      { $match: query },
      {
        $facet: {
          totalData: [
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                totalQuantity: { $sum: { $sum: '$packages.quantity' } },
                grandTotalSum: { $sum: '$grandTotal' },
              },
            },
          ],
          toPayData: [
            { $match: { bookingType: { $regex: /^topay$/i } } }, // Case-insensitive "topay"
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                totalQuantity: { $sum: { $sum: '$packages.quantity' } },
                grandTotalSum: { $sum: '$grandTotal' },
              },
            },
          ],
          byBookingType: [
            {
              $group: {
                _id: '$bookingType', // Case-sensitive grouping
                totalRecords: { $sum: 1 },
                totalQuantity: { $sum: { $sum: '$packages.quantity' } },
                grandTotalSum: { $sum: '$grandTotal' },
              },
            },
          ],
        },
      },
    ]);

    

    // Process aggregation results
    const totalData = result.totalData[0] || { totalRecords: 0, totalQuantity: 0, grandTotalSum: 0 };
    const toPayData = result.toPayData[0] || { totalRecords: 0, totalQuantity: 0, grandTotalSum: 0 };
    const byBookingTypeRaw = result.byBookingType || [];

    // Define case-sensitive booking types
    const bookingTypes = ['credit', 'topay', 'pay', 'foc'];

    // Format byBookingType data (case-sensitive)
    const byBookingType = {};
    bookingTypes.forEach(type => {
      const data = byBookingTypeRaw.find(item => item._id === type) || {
        totalRecords: 0,
        totalQuantity: 0,
        grandTotalSum: 0,
      };
      byBookingType[type] = {
        totalRecords: data.totalRecords,
        totalQuantity: data.totalQuantity,
        grandTotal: data.grandTotalSum,
      };
    });

    // Include any additional case variations from the data
    byBookingTypeRaw.forEach(item => {
      if (!bookingTypes.includes(item._id)) {
        byBookingType[item._id] = {
          totalRecords: item.totalRecords,
          totalQuantity: item.totalQuantity,
          grandTotal: item.grandTotalSum,
        };
      }
    });

    res.status(200).json({
      data: {
        total: {
          totalRecords: totalData.totalRecords,
          totalQuantity: totalData.totalQuantity,
          grandTotal: totalData.grandTotalSum,
        },
        toPay: {
          totalRecords: toPayData.totalRecords,
          totalQuantity: toPayData.totalQuantity,
          grandTotal: toPayData.grandTotalSum,
        },
        byBookingType,
        bookingRecords,
        bookings,
        filters: {
          fromCity: fromCity || 'all',
          toCity: toCity || 'all',
          pickUpBranch: pickUpBranch || 'all',
          dropBranch: dropBranch || 'all',
        },
      },
      message: totalData.totalRecords > 0 ? 'Pending delivery stock report generated' : 'No pending deliveries found',
    });
  } catch (error) {
    console.error('Error generating pending delivery report:', error);
    res.status(500).json({
      message: 'Internal server error',
      error: error.message,
    });
  }
};


const parcelStatusDateDifferenceReport = async (req, res) => {
  try {
    const { startDate, endDate, fromCity, toCity, bookingStatus } = req.body; // Use req.query for GET requests

    // Validate required parameters
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    // Convert dates for querying
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // Include the full day

    // Build query
    let query = { bookingDate: { $gte: start, $lte: end } };
    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (bookingStatus) query.bookingStatus = bookingStatus;

    // Fetch data
    const bookings = await Booking.find(query).select(
      "grnNo bookingDate loadingDate unLoadingDate deliveryDate fromCity toCity bookingStatus parcelGstAmount"
    );

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found for the given criteria" });
    }

    res.status(200).json({
      data: bookings,
      message: "Parcel status date difference report generated successfully"
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const pendingDeliveryLuggageReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch, bookingType } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = { 
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 2
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;
    if (bookingType) query.bookingType = bookingType;

    // Fetch only required fields, including packages
    const pendingDeliveries = await Booking.find(query).select(
      "grnNo lrNumber deliveryDate fromCity toCity senderName senderMobile receiverName grandTotal bookingType packages"
    ).lean(); // Convert documents to plain objects

    if (pendingDeliveries.length === 0) {
      return res.status(404).json({ message: "No pending deliveries found for the given criteria" });
    }

    // Calculate total quantity and total amount from embedded `packages` array
    const formattedDeliveries = pendingDeliveries.map((delivery) => {
      const totalQuantity = delivery.packages.reduce((sum, pkg) => sum + (pkg.quantity || 0), 0);
      const totalAmount = delivery.packages.reduce((sum, pkg) => sum + (pkg.totalPrice || 0), 0);

      return {
        ...delivery,
        totalQuantity,
        totalAmount,
        packageDetails: delivery.packages.map(pkg => ({
          packageType: pkg.packageType,
          quantity: pkg.quantity
        }))
      };
    });

    res.status(200).json({
      success: true,
      data: formattedDeliveries,
      message: "Pending delivery luggage report generated successfully"
    });
  } catch (error) {
    console.error("Error generating pending delivery report:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const parcelReceivedStockReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch, receiverName } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 4,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;
    if (receiverName) query.receiverName = receiverName;

    // Fetch required fields
    const pendingDeliveries = await Booking.find(query)
      .select(
        "grnNo lrNumber deliveryDate unloadingDate senderName senderMobile bookingType bookingStatus receiverName packages"
      )
      .lean();

    if (pendingDeliveries.length === 0) {
      return res.status(404).json({ message: "No pending deliveries found for the given criteria" });
    }

    let totalGrandTotal = 0;
    const updatedDeliveries = pendingDeliveries.map(delivery => {
      const grandTotal = delivery.packages?.reduce((sum, pkg) => sum + (pkg.totalPrice || 0), 0) || 0;
      totalGrandTotal += grandTotal;

      return {
        ...delivery,
        totalPackages: delivery.packages?.length || 0,
        grandTotal,
      };
    });

    // Compute city-wise paid & to-pay amounts
    const citywiseAggregation = await Booking.aggregate([
      { $match: query },
      { $unwind: { path: "$packages", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { city: "$fromCity", branch: "$pickUpBranchname", bookingType: "$bookingType" },
          totalAmount: { $sum: "$packages.totalPrice" },
        },
      },
    ]);

    // Transform citywiseAggregation to merge bookingType amounts
    const mergeCitywiseAggregation = (data) => {
      const result = {};

      data.forEach(entry => {
        const { city, branch, bookingType } = entry._id;
        const key = `${city}-${branch}`;

        if (!result[key]) {
          result[key] = {
            _id: { city, branch },
            totalPaid: 0,
            totalToPay: 0,
            totalCredit: 0
          };
        }

        if (bookingType === "paid") {
          result[key].totalPaid += entry.totalAmount;
        } else if (bookingType === "toPay") {
          result[key].totalToPay += entry.totalAmount;
        } else if (bookingType === "credit") {
          result[key].totalCredit += entry.totalAmount;
        }
      });

      return Object.values(result);
    };

    const transformedCitywiseAggregation = mergeCitywiseAggregation(citywiseAggregation);

    return res.status(200).json({
      data: updatedDeliveries,
      totalGrandTotal,
      citywiseAggregation: transformedCitywiseAggregation,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


const deliveredStockReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 4,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    const stockReport = await Booking.find(query)
      .select(
        "grnNo lrNumber deliveryEmployee senderName senderMobile bookingType receiverName packages parcelGstAmount serviceCharge hamaliCharge doorDeliveryCharge doorPickupCharge"
      )
      .lean();

    if (stockReport.length === 0) {
      return res.status(404).json({ message: "No stock found for the given criteria" });
    }

    let totalGrandTotal = 0;
    let totalGST = 0;
    let totalOtherCharges = 0;

    let bookingWiseDetails = { paid: 0, toPay: 0, credit: 0 };

    const updatedDeliveries = stockReport.map(delivery => {
      const grandTotal = delivery.packages?.reduce((sum, pkg) => sum + (pkg.totalPrice || 0), 0) || 0;
      totalGrandTotal += grandTotal;

      const gst = delivery.parcelGstAmount || 0;
      totalGST += gst;

      const otherCharges =
        (delivery.serviceCharge || 0) +
        (delivery.hamaliCharge || 0) +
        (delivery.doorDeliveryCharge || 0) +
        (delivery.doorPickupCharge || 0);
      totalOtherCharges += otherCharges;

      if (delivery.bookingType === "paid") bookingWiseDetails.paid += grandTotal;
      if (delivery.bookingType === "toPay") bookingWiseDetails.toPay += grandTotal;
      if (delivery.bookingType === "credit") bookingWiseDetails.credit += grandTotal;

      return {
        ...delivery,
        totalPackages: delivery.packages?.length || 0,
        grandTotal,
        gst,
        otherCharges,
      };
    });

    // Calculate net amounts
    const paidNetAmount = bookingWiseDetails.paid + totalGST + totalOtherCharges;
    const toPayNetAmount = bookingWiseDetails.toPay + totalGST + totalOtherCharges;
    const creditNetAmount = bookingWiseDetails.credit + totalGST + totalOtherCharges;

    return res.status(200).json({
      data: updatedDeliveries,
      totalGrandTotal,
      totalGST,
      totalOtherCharges,
      bookingWiseDetails,
      paidNetAmount,
      toPayNetAmount,
      creditNetAmount
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const pendingDispatchStockReport = async (req, res) => {
  try {
    const { fromCity, toCity, pickUpBranch } = req.body;

    let query = { bookingStatus: 2 };

    if (fromCity && fromCity !== "all") query.fromCity = fromCity;
    if (toCity && toCity !== "all") query.toCity = toCity;
    if (pickUpBranch && pickUpBranch !== "all") query.pickUpBranch = pickUpBranch;

    const dispatchReport = await Booking.find(query)
      .select("grnNo lrNumber packages deliveryEmployee senderName bookingStatus senderMobile bookingType receiverName hamaliCharge grandTotal")
      .lean(); // Convert documents to plain objects

    if (dispatchReport.length === 0) {
      return res.status(404).json({ message: "No pending deliveries found for the given criteria" });
    }

    // Initialize variables
    let totalPackages = 0;
    let totalGrandTotalAmount = 0;
    let allTotalWeight = 0;

    let bookingTypeData = {
      paid: [],
      toPay: [],
      credit: [],
    };

    const formattedReport = dispatchReport.map((item) => {
      const packageCount = item.packages ? item.packages.length : 0;
      const totalWeight = item.packages ? item.packages.reduce((sum, pkg) => sum + (pkg.weight || 0), 0) : 0;
      
      totalPackages += packageCount;
      totalGrandTotalAmount += item.grandTotal || 0;
      allTotalWeight += totalWeight;

      // Organize by bookingType
      if (item.bookingType === "paid" || item.bookingType === "toPay" || item.bookingType === "credit") {
        bookingTypeData[item.bookingType].push({
          lrNumber: item.lrNumber,
          totalWeight,
          grandTotal: item.grandTotal || 0,
        });
      }

      return {
        ...item,
        packageCount, // Number of packages
        packages: undefined, // Remove the full `packages` array
      };
    });

    return res.status(200).json({ 
      totalPackages, 
      totalGrandTotalAmount, 
      allTotalWeight, 
      data: formattedReport,
      bookingType: bookingTypeData
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const dispatchedMemoReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch, vehicalNumber } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 1,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;
    if (vehicalNumber) query.vehicalNumber = vehicalNumber;

    const stockReport = await Booking.find(query)
      .select("_id grnNo lrNumber vehicalNumber toCity serviceCharge hamaliCharge grandTotal senderName receiverName senderMobile loadingDate bookingDate bookingType packages")
      .lean();

    let totalPaid = { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 };
    let totalToPay = { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 };
    let totalCredit = { grandTotal: 0, serviceCharge: 0, hamaliCharge: 0 };

    const groupedData = stockReport.reduce((acc, item) => {
      const type = item.bookingType;

      if (!acc[type]) acc[type] = [];
      acc[type].push(item);

      if (type === "paid") {
        totalPaid.grandTotal += item.grandTotal || 0;
        totalPaid.serviceCharge += item.serviceCharge || 0;
        totalPaid.hamaliCharge += item.hamaliCharge || 0;
      } else if (type === "toPay") {
        totalToPay.grandTotal += item.grandTotal || 0;
        totalToPay.serviceCharge += item.serviceCharge || 0;
        totalToPay.hamaliCharge += item.hamaliCharge || 0;
      } else if (type === "credit") {
        totalCredit.grandTotal += item.grandTotal || 0;
        totalCredit.serviceCharge += item.serviceCharge || 0;
        totalCredit.hamaliCharge += item.hamaliCharge || 0;
      }

      return acc;
    }, {});

    return res.status(200).json({
      data: groupedData,
      totalPaid,
      totalToPay,
      totalCredit,
    });
  } catch (error) {
    console.error("Error in dispatchedMemoReport:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


const parcelIncomingLuggagesReport = async (req, res) => {
  try {
    const { fromDate, toDate, fromCity, toCity, pickUpBranch, dropBranch } = req.body;

    if (!fromDate || !toDate) {
      return res.status(400).json({ message: "fromDate and toDate are required" });
    }

    const start = new Date(fromDate);
    const end = new Date(toDate);
    end.setHours(23, 59, 59, 999);

    let query = {
      bookingDate: { $gte: start, $lte: end },
      bookingStatus: 1,
    };

    if (fromCity) query.fromCity = fromCity;
    if (toCity) query.toCity = toCity;
    if (pickUpBranch) query.pickUpBranch = pickUpBranch;
    if (dropBranch) query.dropBranch = dropBranch;

    const stockReport = await Booking.find(query).select(
      "grnNo lrNumber deliveryEmployee senderName senderMobile loadingDate bookingDate bookingType receiverName receiverMobile packages grandTotal"
    ).lean();

    if (stockReport.length === 0) {
      return res.status(404).json({ message: "No stock found for the given criteria" });
    }

    // Calculate total grandTotal
    const totalGrandTotal = stockReport.reduce((sum, record) => sum + (record.grandTotal || 0), 0);

    res.status(200).json({ 
      data: stockReport,
      totalGrandTotal 
    });

  } catch (error) {
    res.status(500).json({ message: "Internal Server Error", error: error.message });
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
parcelBranchWiseGSTReport,
senderReceiverGSTReport,
pendingDeliveryStockReport,
parcelStatusDateDifferenceReport,
pendingDeliveryLuggageReport,
parcelReceivedStockReport,
deliveredStockReport,
pendingDispatchStockReport,
dispatchedMemoReport,
parcelIncomingLuggagesReport

}
 
 