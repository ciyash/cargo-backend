import express from "express";
import cfVoucherController from "../controllers/cf.voucher.controller.js";  
import auth from "../config/auth.middleware.js";
const router = express.Router();


router.post("/credit-voucher-generate",auth, cfVoucherController.creditForVoucherGenerate)

router.post("/",  auth, cfVoucherController.createCFVoucher);

router.get("/",auth, cfVoucherController.getAllCFVouchers);

router.get("/:id", auth, cfVoucherController.getCFVoucherById);

router.patch("/:id", auth, cfVoucherController.updateCFVoucher);

router.delete("/:id", auth, cfVoucherController.deleteCFVoucher);

router.post("/voucher-details",  auth, cfVoucherController.voucherDetails);

router.post("/voucher-details-print",  auth, cfVoucherController.voucherDetailsPrint);

export default router;
