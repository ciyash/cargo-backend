import express from 'express';
import cfExtraChargeController from '../controllers/cf.extra.charge.controller.js';
import auth from '../config/auth.middleware.js';

const router = express.Router();

router.post('/', auth, cfExtraChargeController.createCFExtraCharge);
router.get('/', auth, cfExtraChargeController.getAllCFExtraCharges);
router.get('/:agentName', auth, cfExtraChargeController.getCFExtraChargeByAgentName);
router.patch('/:id', auth, cfExtraChargeController.updateCFExtraCharge);
router.delete('/:id', auth, cfExtraChargeController.deleteCFExtraCharge);

export default router;
