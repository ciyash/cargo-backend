import express from "express";
import parcelUnloadingController from "../controllers/parcel.unloading.controller.js";
import auth from '../config/auth.middleware.js'  

const router = express.Router();

router.post("/parcel-filter-Unloading",auth,parcelUnloadingController.getParcelsLoading)  //loading get

router.get("/grnNo/:grnNo", auth,parcelUnloadingController.getParcelunLoadingByGrnNumber)

router.post("/",auth,parcelUnloadingController.createParcelUnloading)   //post

router.get("/",auth,parcelUnloadingController.getAllParcelUnloadings)

router.get("/:id",auth,parcelUnloadingController.getParcelUnloadingById)

router.get("/voucher/:voucher",auth,parcelUnloadingController.getParcelUnloadingByVoucher)

router.post("/filter",auth,parcelUnloadingController.getParcelsByFilters)

router.patch("/:id",auth,parcelUnloadingController.updateParcelUnloading)

router.delete("/:id",auth,parcelUnloadingController.deleteParcelUnloading)

router.post("/pending-delivery-report",auth,parcelUnloadingController.getUnloadingReport)

router.post("/branch-to-branch-load",auth,parcelUnloadingController.parcelBranchToBranchUnloading)  //loading

router.post("/branch-to-branch-post",auth,parcelUnloadingController.parcelBranchToBranchUnloadingPost)  //loading
  

export default router