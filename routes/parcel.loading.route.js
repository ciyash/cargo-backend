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

router.post("/offline-report",parcelController.getParcelsByFilter)

router.post("/branch-to-branch",parcelController.branchToBranchLoading)

router.post("/updateGrnNumbers",parcelController.updateAllGrnNumbers)

router.post("/get-lrNumber",parcelController.getParcelByLrNumber)

router.get("/vehicalNumber/:vehicalNumber",parcelController.getParcelByVehicalNumber)

router.get("/fromBranch/toBranch/:fromBranch/:toBranch", parcelController.getParcelsByBranch);

router.post("/fromBookingDate/toBookingDate",parcelController.getParcelLoadingBetweenDates)

router.post("/fromBookingDate/toBookingDate/userName",parcelController.getParcelLoadingDates)

router.post("/parcel-offline-report",parcelController.getParcelsByFilters)

router.post("/parcel-status-report",parcelController.parcelStatusReport)  //parcel status date difference report

router.post("/parcel-pending-report",parcelController.parcelPendingReport)  // parcel pending delivery stockreport 

router.post("/parcel-filter-Unloading",parcelController.getParcelsInUnloading)

export default router 