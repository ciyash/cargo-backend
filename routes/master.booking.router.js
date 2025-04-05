import express from 'express';
import masterController from '../controllers/master.booking.controller.js';
import auth from '../config/auth.middleware.js';
const router = express.Router();

router.post('/',auth, masterController.createMasterBooking);
router.get('/', masterController.getAllMasters);
router.get('/:senderName', masterController.getMasterSenderName);
router.patch('/:id',masterController.updateMaster);
router.delete('/:id', masterController.deleteMaster);


export default router;
