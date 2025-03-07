import express from 'express'
import parcelController from '../controllers/pracel.loading.controller.js'

const router=express.Router()

router.post("/",parcelController.createParcel)

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

export default router