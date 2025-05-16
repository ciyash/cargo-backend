import express from 'express';
import bankController from '../controllers/bank.controller.js';

const router = express.Router();

router.post('/create', bankController.createBank); 

router.get('/get', bankController.getAllBanks); 

router.get('/banks/:id', bankController.getBankById); 

router.patch('/banks/:id', bankController.updateBank); 

router.delete('/banks/:id', bankController.deleteBank); 

export default router;
