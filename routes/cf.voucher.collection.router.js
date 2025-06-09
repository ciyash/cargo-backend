import express from "express";
import  cfVoucherCollectionController from "../controllers/cf.voucher.collection.controller.js";
import auth from "../config/auth.middleware.js";

const router = express.Router();

router.post("/voucher-collection-load",auth,cfVoucherCollectionController.getVoucherDetails) //load get

router.post("/",auth, cfVoucherCollectionController.createVoucher);

router.get("/",auth, cfVoucherCollectionController.getAllVouchers);

router.get("/:id",auth, cfVoucherCollectionController.getVoucherById);

router.patch("/:id",auth, cfVoucherCollectionController.updateVoucher);

router.delete("/:id",auth, cfVoucherCollectionController.deleteVoucher);

export default router;
