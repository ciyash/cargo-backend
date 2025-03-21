import {User,Booking} from "../models/booking.model.js";
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


const createBooking = async (req, res) => {
  try {
    const { 
      fromCity, toCity, pickUpBranch, dropBranch, totalPrice, dispatchType, bookingType,
      packages, 
      senderName, senderMobile, senderAddress, senderGst,
      receiverName, receiverMobile, receiverAddress, receiverGst, parcelGstAmount,grandTotal,
      serviceCharge = 0, hamaliCharge = 0, doorDeliveryCharge = 0, doorPickupCharge = 0, valueOfGoods = 0,items
    } = req.body;

    //Validate package details
    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ success: false, message: "At least one package is required" });
    }

    for (const pkg of packages) {
      if (!pkg.quantity || !pkg.packageType || !pkg.weight || !pkg.unitPrice) {
        return res.status(400).json({ success: false, message: "Each package must have quantity, packageType, weight, and unitPrice" });
      }
    }

    const location = req.user.location; 
    console.log("location", location);
    const bookedBy = req.user.id;
    const bookingStatus=0;
    const adminUniqueId = req.user.subadminUniqueId;

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

    //  Calculate totalQuantity from packages
    const totalQuantity = packages.reduce((sum, pkg) => sum + pkg.quantity, 0);

    //  Calculate Grand Total
    // let packageTotal = packages.reduce((sum, pkg) => sum + (pkg.unitPrice * pkg.quantity), 0);
    // let grandTotal = packageTotal + serviceCharge + hamaliCharge + doorDeliveryCharge + doorPickupCharge + valueOfGoods;

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
      bookingDate: new Date()
    });

    const savedBooking = await booking.save();

    if (savedBooking) {
      await Promise.all([
        (async () => {
          const senderExists = await User.findOne({ phone: senderMobile });
          if (!senderExists) {
            await User.create({
              name: senderName,
              phone: senderMobile,
              address: senderAddress,
              gst: senderGst
            });
          }
        })(),
        (async () => {
          const receiverExists = await User.findOne({ phone: receiverMobile });
          if (!receiverExists) {
            await User.create({
              name: receiverName,
              phone: receiverMobile,
              address: receiverAddress,
              gst: receiverGst
            });
          }
        })()
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
    const bookings = await Booking.find()
    if (bookings.length === 0) {
      return res.status(404).json({ success: false, message: "No bookings found" });
    }
    res.status(200).json(bookings);
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
      console.log("Received lrNumber:", lrNumber);
  
      const booking = await Booking.findOne({ lrNumber });
      console.log("Booking Found:", booking);
  
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


const getAllUsers = async (req, res) => {
  try {
    const users = await User.find(); // Fetch all users from DB

    if (!users.length) {
      return res.status(404).json({ message: "No users found!" });
    }

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export default {
  createBooking,
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
  getUsersBySearch,
  getAllUsers
  
}
