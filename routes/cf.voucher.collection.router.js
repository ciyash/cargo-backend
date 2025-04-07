import express from "express";
import  cfVoucherCollectionController from "../controllers/cf.voucher.collection.controller.js";
import auth from "../config/auth.middleware.js";

const router = express.Router();

router.post("/voucher-collection-load",auth,cfVoucherCollectionController.getVoucherDetails) //load get

router.post("/", cfVoucherCollectionController.createVoucher);

router.get("/", cfVoucherCollectionController.getAllVouchers);

router.get("/:id", cfVoucherCollectionController.getVoucherById);

router.patch("/:id", cfVoucherCollectionController.updateVoucher);

router.delete("/:id", cfVoucherCollectionController.deleteVoucher);

export default router;
