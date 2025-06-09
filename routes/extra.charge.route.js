import express from 'express'

import extraChargeController from '../controllers/extra.charge.controller.js'
import auth from '../config/auth.middleware.js'

const router=express.Router()

router.post("/",auth,extraChargeController.createCharge)

router.get("/",auth,extraChargeController.getAllExtraCharge)

router.post("/filter-city-wise",auth, extraChargeController.getChargeFromCityToCity);

router.delete("/:id",auth,extraChargeController.deleteCharge)

router.patch("/:id",auth,extraChargeController.updateChargeById)


export default router