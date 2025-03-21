import express from 'express'

import extraChargeController from '../controllers/extra.charge.controller.js'

const router=express.Router()

router.post("/",extraChargeController.createCharge)

router.get("/",extraChargeController.getAllExtraCharge)

router.post("/filter-city-wise", extraChargeController.getChargeFromCityToCity);

router.delete("/:id",extraChargeController.deleteCharge)

router.patch("/:id",extraChargeController.updateChargeById)


export default router