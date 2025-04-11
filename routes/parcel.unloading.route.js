import express from "express";
import parcelUnloadingController from "../controllers/parcel.unloading.controller.js";
import auth from '../config/auth.middleware.js'  

const router = express.Router();

router.post("/parcel-filter-Unloading",parcelUnloadingController.getParcelsLoading)  //loading get

router.get("/grnNo/:grnNo",parcelUnloadingController.getParcelunLoadingByGrnNumber)

router.post("/",auth,parcelUnloadingController.createParcelUnloading)   //post

router.get("/",parcelUnloadingController.getAllParcelUnloadings)

router.get("/:id",parcelUnloadingController.getParcelUnloadingById)

router.get("/voucher/:voucher",parcelUnloadingController.getParcelUnloadingByVoucher)

router.post("/filter",parcelUnloadingController.getParcelsByFilters)

router.patch("/:id",parcelUnloadingController.updateParcelUnloading)

router.delete("/:id",parcelUnloadingController.deleteParcelUnloading)

router.post("/pending-delivery-report",parcelUnloadingController.getUnloadingReport)

router.post("/branch-to-branch-load",parcelUnloadingController.parcelBranchToBranchUnloading)  //loading
  
router.post("/branch-to-branch-post",auth,parcelUnloadingController.parcelBranchToBranchUnloadingPost)  //loading
  



export default router