import express from "express";
import cfVoucherController from "../controllers/cf.voucher.controller.js";
const router = express.Router();


router.post("/credit-voucher-generate",cfVoucherController.creditForVoucherGenerate)

router.post("/", cfVoucherController.createCFVoucher);

router.get("/", cfVoucherController.getAllCFVouchers); 

router.get("/:id", cfVoucherController.getCFVoucherById);

router.patch("/:id", cfVoucherController.updateCFVoucher);

router.delete("/:id", cfVoucherController.deleteCFVoucher);

router.post("/voucher-details",cfVoucherController.voucherDetails)

router.post("/voucher-details-print",cfVoucherController.voucherDetailsPrint)

export default router;
