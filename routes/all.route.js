import express from 'express'
import auth from '../config/auth.middleware.js'
import bookingController from '../controllers/all.controller.js'

 
const router=express.Router()  


router.post("/parcel-booking-mobileNumber",auth,bookingController.parcelBookingMobileNumber)
router.post("/sales-summary-branchwise",auth,bookingController.salesSummaryByBranchWise)
router.post("/summary-report",auth,bookingController.collectionSummaryReport)
router.post("/branch-account",auth,bookingController.branchAccount)
router.post("/acparty-account",auth,bookingController.acPartyAccount)
export default router