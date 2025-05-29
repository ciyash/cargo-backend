import express from 'express'
import auth from '../config/auth.middleware.js'
import bookingController from '../controllers/booking.controller.js'

 
const router=express.Router()  

   
//users 
 
router.get("/users",auth,bookingController.getAllUsers)  

router.get("/users/search",auth,bookingController.getUsersBySearch)

router.get("/user/:senderMobile",auth,bookingController.getUserByMobile)

router.get("/user/credit",auth,bookingController.getCreditBookings)

// bookings 
 
router.post("/",auth,bookingController.createBooking)

router.get("/",bookingController.getAllBookings)



   
router.get("/todaybookings",auth,bookingController.getBookingBydate)

router.get("/grnNo/:grnNo",auth,bookingController.getBookingByGrnNo)

router.get("/adminUniqueId/:adminUniqueId",auth,bookingController.getBookingadminUniqueId)

router.post("/search-data",auth, bookingController.getBookingsByAnyField);


router.get("/pages",auth,bookingController.getAllBookingsPages)

router.get("/fromCity/:fromCity/toCity/:toCity/:vehicalNumber",auth,bookingController.getBookingsfromCityTotoCity)


router.post("/get-lrNumber",auth,bookingController.getBookinglrNumber)

router.delete("/:id",auth,bookingController.deleteBookings)

router.patch("/:id",auth,bookingController.updateBookings)

router.patch("/grnNo/:grnNo",auth,bookingController.updateGRNBookings)

router.post("/updateAllGrnNumbers",auth,bookingController.updateAllGrnNumbers)

router.post("/unreceived-booking",auth,bookingController.unReceivedBookings)

router.post("/receivedBooking",auth,bookingController.receivedBooking)

router.post("/cancelBooking/:grnNo",auth,bookingController.cancelBooking)   

// reportss

router.post("/parcel-booking-report",auth,bookingController.parcelBookingReports)
router.post("/all-parcel-booking-report",auth,bookingController.allParcelBookingReport)
router.post("/parcel-report-serialNo",auth,bookingController.parcelReportSerialNo)
router.post('/parcel-cancel-report',auth,bookingController.parcelCancelReport)
router.post("/parcel-booking-summary-report",auth,bookingController.parcelBookingSummaryReport)
router.post("/parcel-booking-mobileNumber",auth,bookingController.parcelBookingMobileNumber)
router.post("/regular-customer-booking",auth,bookingController.regularCustomerBooking)

router.post("/branch-Wise-collection-report",auth,bookingController.branchWiseCollectionReport)
router.post("/parcel-branch-consolidated-report",auth,bookingController.parcelBranchConsolidatedReport)
router.post("/parcel-branch-wise-gst-report",auth,bookingController.parcelBranchWiseGSTReport)
router.post("/sender-receiver-gst-report",auth,bookingController.senderReceiverGSTReport)
router.post("/pending-delivery-stock-report",auth,bookingController.pendingDeliveryStockReport) //sudheer
router.post("/parcel-status-date-difference-report",auth,bookingController.parcelStatusDateDifferenceReport)
router.post("/pending-delivery-luggage-report",auth,bookingController.pendingDeliveryLuggageReport)
router.post("/parcel-received-stock-report",auth,bookingController.parcelReceivedStockReport)
router.post("/delivered-stock-report",auth,bookingController.deliveredStockReport)
router.post("/pending-dispatch-stock-report",auth,bookingController.pendingDispatchStockReport)
router.post("/dispatched-memo-report",auth,bookingController.dispatchedMemoReport)
router.post("/parcel-incoming-luggages-report",auth,bookingController.parcelIncomingLuggagesReport)
router.post("/grnNolrNo",auth, bookingController.getBookingByGrnOrLrNumber);

//dashboard booking

router.get("/get-above700",auth,bookingController.getAllBookingsAbove700)
router.post("/sales-summary-branchwise",auth,bookingController.salesSummaryByBranchWise)
router.post("/summary-report",auth,bookingController.collectionSummaryReport)
router.post("/branch-account",auth,bookingController.branchAccount)
router.post("/acparty-account",auth,bookingController.acPartyAccount)
router.get("/status-wise-summary",auth,bookingController.statusWiseSummary)

router.post("/get-total",bookingController.getTotalByBranchAndDate)

export default router
 