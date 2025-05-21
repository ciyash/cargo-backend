// routes/branchReportRoute.js
import express from "express";
import branchReportController from "../controllers/branch.report.controller.js";

const router = express.Router();

// router.post("/create-daily-branchSnapshot",branchReportController.createDailyBranchSnapshot);    

router.post("/get-daily-report", branchReportController.getDailyReport);

router.post("/get-monthly-report", branchReportController.getMonthlyReport);

router.post("/get-yearly-report", branchReportController.getYearlyReport);

router.post("/today-branch", branchReportController.getTodayBranchSummary);

export default router;
    