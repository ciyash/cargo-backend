import express from 'express';
import itemController from '../controllers/item.controller.js';

const router = express.Router();

router.post('/create', itemController.createItem);


router.get('/get', itemController.getItems);

router.get('/items/:id', itemController.getItemById);

router.patch('/items/:id', itemController.updateItem);

router.delete('/items/:id', itemController.deleteItem);

export default router;
