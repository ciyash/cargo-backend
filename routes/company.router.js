import express from "express";
import companyController from '../controllers/company.controller.js';
import companyAuth from '../config/company.auth.js';
import multer from 'multer';

const router = express.Router();


const storage=multer.memoryStorage()

const upload=multer({storage}).single("logo")


router.post("/subsidiary/register", upload,companyController.registerSubsidiaryCompany); 

router.post("/subsidiary/login", companyController.loginCompany); 

router.post("/company-access", companyAuth, companyController.checkCompanyAccess); // Check if company has access to a project

router.get("/get-companies", companyController.getAllCompanies);    // Get all companies

router.patch("/update", companyAuth, upload, companyController.updateCompany); // Update company details

router.get("/subsidiaries/:parentCompanyId", companyController.getSubsidiaries);

// router.post("/toggle-project", companyController.toggleProjectAccess);

router.delete("/delete/:id",companyController.deleteCompany);

router.post("/subscription", companyAuth, companyController.setSubscription);

router.get("/check/membership/:companyId", companyController.checkMembershipStatus);

export default router;
