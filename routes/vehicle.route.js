import express from 'express'
import vehicleController from '../controllers/vehicle.controller.js'
import auth from '../config/auth.middleware.js'

const router=express.Router()

router.post("/",auth,vehicleController.createVehicle)

router.get("/",auth,vehicleController.getAllVehicles)

router.get("/:id",auth,vehicleController.getVehicleById)

router.get("/getVehicleNo/:vehicleNo",auth,vehicleController.getVehicleNo)

router.patch("/:id",auth,vehicleController.updateVehicle)

router.delete("/:id",auth,vehicleController.deleteVehicle)

router.get("/status/:status",auth, vehicleController.getVehiclesByStatus);


export default router

