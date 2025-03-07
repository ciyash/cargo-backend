import express from "express";
import parcelUnloadingController from "../controllers/parcel.unloading.controller.js";

const router = express.Router();

router.post("/",parcelUnloadingController.createParcelUnloading)

router.get("/",parcelUnloadingController.getAllParcelUnloadings)

router.get("/grnNo/:grnNo",parcelUnloadingController.getParcelunLoadingByGrnNumber)

router.get("/:id",parcelUnloadingController.getParcelUnloadingById)

router.get("/voucher/:voucher",parcelUnloadingController.getParcelUnloadingByVoucher)

router.post("/fromDate/toDate/fromCity/toCity/branch/vehicleNo",parcelUnloadingController.getParcelsByFilters)

router.patch("/:id",parcelUnloadingController.updateParcelUnloading)

router.delete("/:id",parcelUnloadingController.deleteParcelUnloading)

export default router