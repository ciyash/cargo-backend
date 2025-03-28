import express from 'express';
import masterController from '../controllers/master.controller.js';
const router = express.Router();

router.post('/', masterController.createMaster);
router.get('/', masterController.getAllMasters);
router.get('/:id', masterController.getMasterById);
router.patch('/:id',masterController.updateMaster);
router.delete('/:id', masterController.deleteMaster);

export default router;
