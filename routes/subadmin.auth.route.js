import express from 'express'
import subAdminAuthController from '../controllers/subadmin.auth.controller.js'

const router=express.Router()  

router.post("/signup",subAdminAuthController.signup)

router.post("/login",subAdminAuthController.login)

router.get("/subadmins",subAdminAuthController.getAllSubadmins)

router.get("/:id",subAdminAuthController.getSubadminById)

router.patch("/:id",subAdminAuthController.updateSubadmin)

router.post("/change-password",subAdminAuthController.changeSubadminPassword)

router.post("/reset-password",subAdminAuthController.resetPassword)

router.post("/forgot-password",subAdminAuthController.forgotPassword)

router.delete("/:id",subAdminAuthController.deleteSubadmin)



export default router