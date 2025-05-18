// routes/branchReportRoute.js
import express from "express";
import branchReportController from "../controllers/branch.report.controller.js";

const router = express.Router();

router.post("/branch",branchReportController.getBranchReport);

router.post("/daily-net-collection", branchReportController.getDailyNetCollection);

router.post("/branch-snapshot", branchReportController.getDailyBranchSnapshot);

export default router;
