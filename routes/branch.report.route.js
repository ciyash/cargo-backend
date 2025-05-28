import express from "express";
import branchReportController from "../controllers/branch.report.controller.js";

const router = express.Router();

// Snapshot
router.get('/:branchCode/live-snapshot', async (req, res) => {
  try {
    const { branchCode } = req.params;
    const snapshot = await branchReportController.getLiveBranchSnapshot(branchCode);  
    res.status(200).json(snapshot);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch live snapshot", error: err.message });
  }
});

// Live status
router.get('/:branchCode/live-status', branchReportController.getLiveStatus);

export default router;
