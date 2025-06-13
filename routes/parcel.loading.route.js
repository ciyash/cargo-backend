import express from 'express'
import parcelController from '../controllers/pracel.loading.controller.js'
import auth from '../config/auth.middleware.js'

const router=express.Router()   

router.post("/parcel-loding-load" ,auth,parcelController.getBookingsBetweenDates);

router.post("/",auth,parcelController.createParcel)
 
router.get("/",auth,parcelController.getAllParcels)

router.get("/:id",parcelController.getParcelById)   

router.get("/vocherNoUnique/:vocherNoUnique",parcelController.getParcelVocherNoUnique)

router.get("/voucher-details-print/:vocherNoUnique",parcelController.offlineParcelVoucherDetailsPrint)

router.patch("/:id",auth,parcelController.updateParcel)

router.delete("/:id",auth,parcelController.deleteParcel)

router.post("/updateGrnNumbers",auth,parcelController.updateAllGrnNumbers)

router.post("/get-lrNumber",auth,parcelController.getParcelByLrNumber)

router.get("/grnNo/:grnNo",auth,parcelController.getParcelByGrnNo)

router.get("/vehicalNumber/:vehicalNumber",auth,parcelController.getParcelByVehicalNumber)

router.post("/offline-parcel-voucher-details",auth,parcelController.offlineParcelVoucherDetails)

router.post("/parcel-offline-report",auth,parcelController.parcelOfflineReport) // parcel offline report

router.post("/parcel-status-report",auth,parcelController.parcelStatusReport)  //parcel status date difference report

router.post("/parcel-pending-report",auth, parcelController.parcelPendingReport)  // parcel pending delivery stockreport

router.post("/branch-to-branch-load",auth,parcelController.getBookingsByDateAndBranch) //branch to branch loading

router.post("/branch-to-branch-post",auth,parcelController.createBranchToBranch)  // branch to branch post



// reports

router.post("/dispatched-stock-report",auth,parcelController.dispatchedStockReport)



export default router    