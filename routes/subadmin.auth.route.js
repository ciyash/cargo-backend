import express from 'express'
import subAdminAuthController from '../controllers/subadmin.auth.controller.js'
import auth from '../config/auth.middleware.js'
import companyAuth from '../config/company.auth.js'

const router=express.Router()  

router.post("/signup",companyAuth,subAdminAuthController.signup)

router.post("/login",subAdminAuthController.login)

router.get("/subadmins",companyAuth,subAdminAuthController.getAllSubadmins)

router.get("/profile",auth,subAdminAuthController.getSubadminById)

router.patch("/update-profile",auth,subAdminAuthController.updateSubadmin)

router.post("/change-password",auth,subAdminAuthController.changeSubadminPassword)

router.post("/reset-password",auth,subAdminAuthController.resetPassword)

router.post("/forgot-password",auth,subAdminAuthController.forgotPassword)

router.delete("/delete-subadmin",auth,subAdminAuthController.deleteSubadmin)  

router.get("/branch-wise/:branchName",auth,subAdminAuthController.getSubadminsByBranchName)


export default router