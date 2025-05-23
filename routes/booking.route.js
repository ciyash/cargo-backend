import express from 'express'
import auth from '../config/auth.middleware.js'
import bookingController from '../controllers/booking.controller.js'

 
const router=express.Router()  


//users 
 
router.get("/users",bookingController.getAllUsers)  

router.get("/users/search",bookingController.getUsersBySearch)

router.get("/user/:senderMobile",bookingController.getUserByMobile)

router.get("/user/credit",bookingController.getCreditBookings)

// bookings 
 
router.post("/",auth,bookingController.createBooking)

router.get("/",bookingController.getAllBookings)



   
router.get("/todaybookings",auth,bookingController.getBookingBydate)
   
router.get("/grnNo/:grnNo",bookingController.getBookingByGrnNo)
 
router.get("/adminUniqueId/:adminUniqueId",bookingController.getBookingadminUniqueId)
 
router.post("/search-data", bookingController.getBookingsByAnyField);


router.get("/pages",bookingController.getAllBookingsPages)
 
router.get("/fromCity/:fromCity/toCity/:toCity/:vehicalNumber",bookingController.getBookingsfromCityTotoCity)
 

 
router.post("/get-lrNumber",bookingController.getBookinglrNumber)
 
router.delete("/:id",bookingController.deleteBookings)
 
router.patch("/:id",bookingController.updateBookings)
 
router.patch("/grnNo/:grnNo",bookingController.updateGRNBookings)
 
router.post("/updateAllGrnNumbers",bookingController.updateAllGrnNumbers)

router.post("/unreceived-booking",bookingController.unReceivedBookings)
  
router.post("/receivedBooking",auth,bookingController.receivedBooking)

router.post("/cancelBooking/:grnNo",auth,bookingController.cancelBooking)   

// reportss

router.post("/parcel-booking-reports",auth,bookingController.parcelBookingReports)
router.post("/all-parcel-booking-report",auth,bookingController.allParcelBookingReport)
router.post("/parcel-report-serialNo",auth,bookingController.parcelReportSerialNo)
router.post('/parcel-cancel-report',auth,bookingController.parcelCancelReport)
router.post("/parcel-booking-summary-report",bookingController.parcelBookingSummaryReport)
router.post("/parcel-booking-mobileNumber",auth,bookingController.parcelBookingMobileNumber)
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

//dashboard booking

router.get("/get-above700",bookingController.getAllBookingsAbove700)
router.post("/sales-summary-branchwise",bookingController.salesSummaryByBranchWise)
router.post("/summary-report",bookingController.collectionSummaryReport)
router.post("/branch-account",bookingController.branchAccount)
router.post("/acparty-account",bookingController.acPartyAccount)
router.get("/status-wise-summary",bookingController.statusWiseSummary)

router.post("/get-total",bookingController.getTotalByBranchAndDate)

export default router
 