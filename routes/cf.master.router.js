import express from 'express';
import cfMasterController from '../controllers/cf.master.controller.js';

const router = express.Router();

router.post('/', cfMasterController.createMasterBooking);
router.get('/', cfMasterController.getAllMasters);
router.get('/search/:name', cfMasterController.getMasterByName);
router.patch('/:id', cfMasterController.updateMaster);
router.delete('/:id', cfMasterController.deleteMaster);
router.get("/city/:city",cfMasterController.getCFMasterByCity)

export default router;
