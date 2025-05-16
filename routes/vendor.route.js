import  VendorController from '../controllers/vendor.controller.js';
import express from 'express';                  
const router = express.Router();
          
router.post('/create', VendorController.createVendor);

router.get('/get', VendorController.getAllVendors); 

router.get('/:id', VendorController.getVendorById);

router.patch('/:id', VendorController.updateVendor);

router.delete('/:id', VendorController.deleteVendor);

export default router;
