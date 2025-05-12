import express from 'express'
import auth from '../config/auth.middleware.js'
import bookingController from '../controllers/all.controller.js'

 
const router=express.Router()  

//subadmin routes only subadmin can access this routes


router.post("/parcel-booking-mobileNumber",auth,bookingController.parcelBookingMobileNumber)
router.post("/sales-summary-branchwise",auth,bookingController.salesSummaryByBranchWise)
router.post("/summary-report",auth,bookingController.collectionSummaryReport)
router.post("/branch-account",auth,bookingController.branchAccount)
router.post("/acparty-account",auth,bookingController.acPartyAccount)
router.get("/status-wise-summary",auth,bookingController.statusWiseSummary)

// employee routes only employee can access this routes

router.post("/parcel-booking-reports",auth,bookingController.parcelBookingReports)
router.post("/parcel-report-serialNo",auth,bookingController.parcelReportSerialNo)
router.post('/parcel-cancel-report',auth,bookingController.parcelCancelReport)
router.post("/parcel-booking-employee-mobileNumber",auth,bookingController.parcelBookingMobileNumberByEmployee)
router.post("/parcel-status-date-difference-report",auth,bookingController.parcelStatusDateDifferenceReport)

export default router