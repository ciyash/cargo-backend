import Booking from "../models/booking.model.js";
import moment from "moment";
 
const generateGrnNumber = async () => {
  const lastBooking = await Booking.findOne().sort({ createdAt: -1 });
  return lastBooking ? lastBooking.grnNumber + 1 : 1000; // Always increment globally
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


const createBooking = async (req, res) => {
  try {
    const { 
      fromCity, toCity, pickUpBranch, dropBranch,totalPrice, location, dispatchType, bookingType,
      quantity, packageType,contains,vehicalNumber, senderName, senderMobile, senderAddress, unitPrice,
      receiverName, receiverMobile, receiverAddress, serviceCharge = 0, 
      hamaliCharge = 0, doorDeliveryCharge = 0, doorPickupCharge = 0, valueOfGoods = 0,
      bookingStatus, receiptNo, adminUniqueId, adminId, items, eWayBillNo, 
      ltCity = "", ltBranch = "", ltEmployee = "", deliveryEmployee = "",
      cancelByUser = "", cancelDate = "", cancelCity = "", cancelBranch = "",
      refundCharge = 0, refundAmount = 0,senderGst,receiverGst,parcelGst
    } = req.body;

   
    // const requiredFields = [
    //   "fromCity", "toCity", "pickUpBranch", "dropBranch","totalPrice", "location", "dispatchType", "bookingType",
    //   "quantity", "packageType","vehicalNumber" , "senderName", "senderMobile", "senderAddress", "unitPrice",
    //   "receiverName", "receiverMobile", "receiverAddress", "adminUniqueId", "adminId",
    //   "items", "eWayBillNo"
    // ];

    // for (const field of requiredFields) {
    //   if (!req.body[field]) {
    //     return res.status(400).json({ success: false, message: `${field} is required` });
    //   }
    // }

    // ✅ Generate GRN and LR numbers
    const grnNumber = await generateGrnNumber();
    const lrNumber = await generateLrNumber(fromCity, location);

    // Generate receiptNo if not provided
    const generatedReceiptNo = receiptNo || `REC-${Date.now()}`;

    // Create new booking object
    const booking = new Booking({
      grnNumber,
      lrNumber,
      location,
      fromCity,
      toCity,
      pickUpBranch,
      dropBranch,
      dispatchType,
      contains,
      vehicalNumber,
      bookingType,
      quantity,
      packageType,
      senderName,
      senderMobile,
      senderAddress,
      unitPrice,
      receiverName,
      receiverMobile,
      receiverAddress,
      receiptNo: generatedReceiptNo, 
      totalPrice,
      grandTotal: (unitPrice * quantity) + serviceCharge + hamaliCharge + doorDeliveryCharge + doorPickupCharge + valueOfGoods,
      serviceCharge,
      hamaliCharge,
      doorDeliveryCharge,
      doorPickupCharge,
      valueOfGoods,
      bookingStatus,
      adminUniqueId,
      adminId,
      items,
      eWayBillNo,
      bookingDate: new Date(),
      ltDate: new Date(),
      ltCity,
      ltBranch,
      ltEmployee,
      deliveryEmployee,
      cancelByUser,
      cancelDate: cancelDate ? new Date(cancelDate) : "",
      cancelCity,
      cancelBranch,
      refundCharge,
      refundAmount,
      senderGst,
      receiverGst,
      parcelGst
    });

    await booking.save();

    res.status(201).json({ success: true, message: "Booking created successfully", data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate("adminId")
    if (bookings.length === 0) {
      return res.status(404).json({ success: false, message: "No bookings found" });
    }
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

  const getBookingByGrnNo = async (req, res) => {
    try {
      const { grnNumber } = req.params;
  
      if (!grnNumber) {
        return res.status(400).json({ success: false, message: "grnNumber is required" });
      }
  
      const booking = await Booking.findOne({ grnNumber });
  
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
     const booking=await Booking.find({adminUniqueId}).populate("adminId",'name email role  username phone branchName branchId ')
     if(!booking){
      return res.status(404).json({message:"No adminUniqueId bookings !"})
     }
     res.status(200).json(booking)
    }
    catch(error){
      res.status(500).json({error:error.message})
    }
  }

  
  const getBookingBysenderMobile = async(req,res) => {
    try{
      const {senderMobile}=req.params
      const booking=await Booking.find({senderMobile})

      if(!booking){
        return res.status(404).json({message:"No bookings found!"})
      }
      res.status(200).json(booking)
    }
    catch(error){
    res.status(500).json({message:error.message})
    }
  }

  const getBookingbyreceiverMobile=async(req,res) => {
    try{
      const {receiverMobile}=req.params
      const booking=await Booking.find({receiverMobile})
      if(!booking){
        return res.status(404).json({message:"No receiverMobile "})
      }
      res.status(200).json(booking)
    }
    catch(error){
     res.status(500).json({message:error.message})
    }
  }

  const getBookingsenderName=async(req,res) =>{
    try{
    const {senderName} =req.params
    const booking= await Booking.find({senderName})
    if(!booking){
      return res.status(404).json({message:"senderName not found in bookings"})
    }
    res.status(200).json(booking)
    }
    catch(error){
      res.status(500).json({message:error.message})
    }
  }

  const getBookingsreceiverName=async(req,res) =>{
    try{
    const {receiverName} =req.params
    const booking= await Booking.find({receiverName})
    if(!booking){
      return res.status(404).json({message:"ReceiverName not found in bookings"})
    }
    res.status(200).json(booking)
    }
    catch(error){
      res.status(500).json({message:error.message})
    }
  }

  const getBookingPickUpBranch=async(req,res) => {
    try{
      const {pickUpBranch} =req.params
      const booking= await Booking.find({pickUpBranch})
      if(!booking){
        return res.status(404).json({message:"pickUpBranch not found in bookings"})
      }
      res.status(200).json(booking)
      }
      catch(error){
        res.status(500).json({message:error.message})
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

const getBookingsByGstParams = async (req, res) => {
  try {
      const { senderGst, receiverGst, parcelGst } = req.params;

      // Build dynamic query based on available parameters
      let query = {};
      if (senderGst) query.senderGst = senderGst;
      if (receiverGst) query.receiverGst = receiverGst;
      if (parcelGst) query.parcelGst = parcelGst;

      // Ensure at least one GST parameter is provided
      if (Object.keys(query).length === 0) {
          return res.status(400).json({ success: false, message: "At least one GST parameter (senderGst, receiverGst, or parcelGst) is required" });
      }

      // Fetch matching bookings
      const bookings = await Booking.find(query);

      if (bookings.length === 0) {
          return res.status(404).json({ success: false, message: "No bookings found for the given GST details" });
      }

      res.status(200).json({ success: true, data: bookings });
  } catch (error) {
      res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

const getBookingsfromCityTotoCity=async(req,res) => {
  try{
   const {fromCity,toCity,vehicalNumber}=req.params

   if(!fromCity || !toCity || !vehicalNumber){
    return res.status(400).json({message:"Required fields are missing !"})
   }
   const booking=await Booking.find({fromCity,toCity,vehicalNumber})
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
    const { startDate, endDate } = req.body;

    if (!startDate || !endDate) {  
      return res.status(400).json({ message: "Start date and end date are required!" });
    }

    // Convert startDate and endDate to Date objects
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate date conversion
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Invalid date format!" });
    }

    // Ensure endDate includes the entire day (set time to 23:59:59)
    end.setHours(23, 59, 59, 999);

    // Find bookings where bookingDate is between startDate and endDate
    const bookings = await Booking.find({
      bookingDate: {
        $gte: start, // Greater than or equal to startDate
        $lte: end,   // Less than or equal to endDate (full day included)
      },
    });

    if (bookings.length === 0) {
      return res.status(404).json({ message: "No bookings found in the given date range!" });
    }

    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export default {createBooking,
  getAllBookings,
  getBookingByGrnNo,
  deleteBookings,
  updateBookings,
  getBookingBysenderMobile,
  getBookingbyreceiverMobile,
  getBookingsenderName,
  getBookingsreceiverName,
  getBookingadminUniqueId,
  getBookingPickUpBranch,
  updateGRNBookings,
  getBookinglrNumber,
  updateAllGrnNumbers,
  getBookingsByGstParams,
  getBookingsfromCityTotoCity,
  getBookingsBetweenDates
}
