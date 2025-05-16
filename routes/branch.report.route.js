// routes/branchReportRoute.js
import express from "express";
import branchReportController from "../controllers/branch.report.controller.js";

const router = express.Router();

router.get("/:branchId",branchReportController.getBranchReport);

export default router;
