// routes/branchReportRoute.js
import express from "express";
import branchReportController from "../controllers/branch.report.controller.js";

const router = express.Router();

// GET /api/branches/:branchCode/live-snapshot
router.get('/:branchCode/live-snapshot', async (req, res) => {
  try {
    const { branchCode } = req.params;
    const snapshot = await branchReportController.getLiveBranchSnapshot(branchCode);
    res.status(200).json(snapshot);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch live snapshot", error: err.message });
  }
});

router.get('/:branchCode/live-status', async (req, res) => {
  try {
    const { branchCode } = req.params;
    const status = await getLiveBranchStatus(branchCode);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch live status' });
  }
});



export default router;
    