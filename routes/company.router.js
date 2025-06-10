import express from "express";
import companyController from '../controllers/company.controller.js';
import companyAuth from '../config/company.auth.js';

const router = express.Router();



router.post("/subsidiary/register", companyController.registerSubsidiaryCompany); 

router.post("/subsidiary/login", companyController.loginCompany); 

router.get("/get-companies", companyController.getAllCompanies);    // Get all companies

router.patch("/update", companyAuth, companyController.updateCompany); // Update company details

router.get("/subsidiaries/:parentCompanyId", companyController.getSubsidiaries);

router.post("/toggle-project", companyController.toggleProjectAccess);

router.delete("/delete/:id",companyController.deleteCompany);

router.post("/subscription", companyController.setSubscription);

router.get("/check/membership/:companyId", companyController.checkMembershipStatus);

export default router;
