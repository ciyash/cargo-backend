import express from 'express';
import bankController from '../controllers/bankController.js';

const router = express.Router();

router.post('/banks', bankController.createBank); // Create a bank record
router.get('/banks', bankController.getAllBanks); // Get all bank records
router.get('/banks/:id', bankController.getBankById); // Get a single bank record by ID
router.put('/banks/:id', bankController.updateBank); // Update a bank record by ID
router.delete('/banks/:id', bankController.deleteBank); // Delete a bank record by ID

export default router;
