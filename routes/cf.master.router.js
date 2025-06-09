import express from 'express';
import cfMasterController from '../controllers/cf.master.controller.js';
import auth from '../config/auth.middleware.js';
const router = express.Router();

router.post('/', auth, cfMasterController.createMaster);
router.get('/', auth, cfMasterController.getAllMasters);
router.get('/search/:name', auth, cfMasterController.getMasterByName);
router.patch('/:id', auth, cfMasterController.updateMaster);
router.delete('/:id', auth, cfMasterController.deleteMaster);
router.get("/city/:city", auth, cfMasterController.getCFMasterByCity);

export default router;
