import express from 'express'
import subAdminAuthController from '../controllers/subadmin.auth.controller.js'
import auth from '../config/auth.middleware.js'

const router=express.Router()  

router.post("/signup",subAdminAuthController.signup)

router.post("/login",subAdminAuthController.login)

router.get("/subadmins",subAdminAuthController.getAllSubadmins)

router.get("/profile",auth,subAdminAuthController.getSubadminById)

router.patch("/update-profile",auth,subAdminAuthController.updateSubadmin)

router.post("/change-password",auth,subAdminAuthController.changeSubadminPassword)

router.post("/reset-password",subAdminAuthController.resetPassword)

router.post("/forgot-password",subAdminAuthController.forgotPassword) 

router.delete("/delete-subadmin",auth,subAdminAuthController.deleteSubadmin)  


export default router