import express from 'express'
import auth from '../config/auth.middleware.js'
import bookingController from '../controllers/booking.controller.js'

 
 
const router=express.Router()  
 
router.post("/",auth,bookingController.createBooking)

router.get("/",bookingController.getAllBookings)
 
router.get("/users",bookingController.getAllUsers)  

router.get("/users/search",bookingController.getUsersBySearch)
   
router.get("/todaybookings",auth,bookingController.getBookingBydate)
   
router.get("/grnNo/:grnNo",bookingController.getBookingByGrnNo)
 
router.get("/adminUniqueId/:adminUniqueId",bookingController.getBookingadminUniqueId)
 
router.get("/search/:searchField/:query", bookingController.getBookingsByAnyField);


router.get("/pages",bookingController.getAllBookingsPages)
 
router.get("/fromCity/:fromCity/toCity/:toCity/:vehicalNumber",bookingController.getBookingsfromCityTotoCity)
 

 
router.post("/get-lrNumber",bookingController.getBookinglrNumber)
 
router.delete("/:id",bookingController.deleteBookings)
 
router.patch("/:id",bookingController.updateBookings)
 
router.patch("/grnNoUnique/:grnNoUnique",bookingController.updateGRNBookings)
 
router.post("/updateAllGrnNumbers",bookingController.updateAllGrnNumbers)
  
router.post("/receivedBooking",auth,bookingController.receivedBooking)

router.post("/cancelBooking/:grnNo",auth,bookingController.cancelBooking)

// reports 

router.post("/parcel-booking-reports",bookingController.parcelBookingReports)
router.post("/all-parcel-booking-report",bookingController.allParcelBookingReport)
router.post("/parcel-report-serialNo",bookingController.parcelReportSerialNo)
router.post('/parcel-cancel-report',bookingController.parcelCancelReport)
router.post("/parcel-booking-summary-report",bookingController.parcelBookingSummaryReport)
router.post("/parcel-booking-mobileNumber",bookingController.parcelBookingMobileNumber)
router.post("/regular-customer-booking",bookingController.regularCustomerBooking)

router.post("/branch-Wise-collection-report",bookingController.branchWiseCollectionReport)
router.post("/parcel-branch-consolidated-report",bookingController.parcelBranchConsolidatedReport)
router.post("/parcel-branch-wise-gst-report",bookingController.parcelBranchWiseGSTReport)
router.post("/sender-receiver-gst-report",bookingController.senderReceiverGSTReport)
router.post("/pending-delivery-stock-report",bookingController.pendingDeliveryStockReport) //sudheer 
router.post("/parcel-status-date-difference-report",bookingController.parcelStatusDateDifferenceReport)
router.post("/pending-delivery-luggage-report",bookingController.pendingDeliveryLuggageReport)
router.post("/parcel-received-stock-report",bookingController.parcelReceivedStockReport)
router.post("/delivered-stock-report",bookingController.deliveredStockReport) 
router.post("/pending-dispatch-stock-report",bookingController.pendingDispatchStockReport)
router.post("/dispatched-memo-report",bookingController.dispatchedMemoReport)
router.post("/parcel-incoming-luggages-report",bookingController.parcelIncomingLuggagesReport)
router.post("/grnNolrNo", bookingController.getBookingByGrnOrLrNumber);


export default router
