import express from 'express'
import parcelController from '../controllers/pracel.loading.controller.js'
import auth from '../config/auth.middleware.js'

const router=express.Router()   

router.post("/",auth,parcelController.createParcel)

router.get("/",parcelController.getAllParcels)

router.get("/:id",parcelController.getParcelById)  

router.get("/vocherNoUnique/:vocherNoUnique",parcelController.getParcelVocherNoUnique)

router.patch("/:id",parcelController.updateParcel)
  
router.delete("/:id",parcelController.deleteParcel)

router.post("/updateGrnNumbers",parcelController.updateAllGrnNumbers)

router.post("/get-lrNumber",parcelController.getParcelByLrNumber)

router.post("/grnNo",parcelController.getParcelByGrnNo)

router.get("/vehicalNumber/:vehicalNumber",parcelController.getParcelByVehicalNumber)

router.post("/offline-parcel-voucher-details",parcelController.offlineParcelVoucherDetails)

router.post("/parcel-offline-report",parcelController.getParcelsByFilter)

router.post("/parcel-status-report",parcelController.parcelStatusReport)  //parcel status date difference report

router.post("/parcel-pending-report",parcelController.parcelPendingReport)  // parcel pending delivery stockreport 

router.post("/branch-to-branch-load",parcelController.getBookingsByDateAndBranch) //branch to branch loading

router.post("/branch-to-branch-post",auth,parcelController.createBranchToBranch)  // branch to branch post


export default router    