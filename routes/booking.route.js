import express from 'express'
import auth from '../config/auth.middleware.js'
import bookingController from '../controllers/booking.controller.js'
 
 
const router=express.Router()  
 
router.post("/",auth,bookingController.createBooking)
 
router.get("/",bookingController.getAllBookings)
 
router.get("/users",bookingController.getAllUsers)
 
router.get("/todaybookings",auth,bookingController.getBookingBydate)
 
router.get("/grnNo/:grnNo",bookingController.getBookingByGrnNo)
 
router.get("/adminUniqueId/:adminUniqueId",bookingController.getBookingadminUniqueId)
 
router.get("/search/:query", bookingController.getBookingsByAnyField);
 
router.get("/pages",bookingController.getAllBookingsPages)
 
router.get("/fromCity/:fromCity/toCity/:toCity/:vehicalNumber",bookingController.getBookingsfromCityTotoCity)
 
router.post("/filterDates" ,bookingController.getBookingsBetweenDates);
 
router.post("/get-lrNumber",bookingController.getBookinglrNumber)
 
router.delete("/:id",bookingController.deleteBookings)
 
router.patch("/:id",bookingController.updateBookings)
 
router.patch("/grnNoUnique/:grnNoUnique",bookingController.updateGRNBookings)
 
router.post("/updateAllGrnNumbers",bookingController.updateAllGrnNumbers)
 
router.post("/city-wise-booking",bookingController.cityWiseBookings)  // city wise booking
 
 
 
 
export default router
 