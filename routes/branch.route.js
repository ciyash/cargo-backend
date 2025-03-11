import express from "express";
import branchController from '../controllers/branch.controller.js'
import auth from '../config/auth.middleware.js'
const router = express.Router();

router.post("/", auth,branchController.createBranch); 
router.get("/", branchController.getAllBranches); 
router.get("/branchUniqueId/:branchUniqueId", branchController.getBranchByUniqueId); 
router.get("/subadminUniqueId/:subadminUniqueId",branchController.getBranchBySubadminUniqueId)
router.post("/dateRange",branchController.getBranchByDateRange)
router.get("/:id",branchController.getbranchId)
router.patch("/update/:id", branchController.updateBranch); 
router.delete("/delete/:id", branchController.deleteBranch);

export default router;
