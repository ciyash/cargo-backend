import express from 'express';
import cfExtraChargeController from '../controllers/cf.extra.charge.controller.js';

const router = express.Router();

router.post('/', cfExtraChargeController.createCFExtraCharge);
router.get('/', cfExtraChargeController.getAllCFExtraCharges);
router.get('/:agentName', cfExtraChargeController.getCFExtraChargeByAgentName);
router.patch('/:id', cfExtraChargeController.updateCFExtraCharge);
router.delete('/:id', cfExtraChargeController.deleteCFExtraCharge);

export default router;
