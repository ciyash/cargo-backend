import express from "express";

import cfCollectionUserController from '../controllers/cf.collection.user.controller.js'

const router = express.Router();

router.post("/", cfCollectionUserController.createCFCollectionUser);

router.get("/", cfCollectionUserController.getAllCFCollectionUsers);

router.patch("/:id", cfCollectionUserController.updateCFCollectionUser);

router.delete("/:id", cfCollectionUserController.deleteCFCollectionUser);

router.get("/name/:name",cfCollectionUserController.getAllCFCollectionUsers)

export default router;
