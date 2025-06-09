import express from "express";
import cityController from '../controllers/city.controller.js'
import dispatchTypeController from "../controllers/dispatchType.controller.js";
import packageTypeController from "../controllers/packageType.controller.js";
import assetController from "../controllers/asset.controller.js";
import expenditureController from "../controllers/expenditure.controller.js";
import auth from '../config/auth.middleware.js'

const router = express.Router();

// City Routes
router.post("/cities",auth, cityController.createCity);
router.get("/cities",auth, cityController.getCities);
router.patch("/cities/:id",auth, cityController.updateCity);
router.delete("/cities/:id",auth, cityController.deleteCity);

//  Ensure it's a static route (not "/cities/:cityIds")
router.post("/cities/delete-cities",auth, cityController.deleteSelectedCities);

// DispatchType Routes
router.post("/dispatch-types", auth, dispatchTypeController.createDispatchType);
router.get("/dispatch-types", auth, dispatchTypeController.getDispatchTypes);
router.get("/dispatch-types/:id", auth, dispatchTypeController.getDispatchTypeById);
router.patch("/dispatch-types/:id", auth, dispatchTypeController.updateDispatchType);
router.delete("/dispatch-types/:id", auth, dispatchTypeController.deleteDispatchType);

// PackageType Routes
router.post("/package-types", auth, packageTypeController.createPackageType);
router.get("/package-types", auth, packageTypeController.getPackageTypes);
router.get("/package-types/:id", auth, packageTypeController.getPackageTypeById);
router.patch("/package-types/:id", auth, packageTypeController.updatePackageType);
router.delete("/package-types/:id", auth, packageTypeController.deletePackageType);

// Asset Routes
router.post("/assets", auth, assetController.createAsset);
router.get("/assets", auth, assetController.getAssets);
router.get("/assets/assetType/:assetType", auth, assetController.getByAssetTypes);
router.patch("/assets/:id", auth, assetController.updateAsset);
router.delete("/assets/:id", auth, assetController.deleteAsset);

// Expenditure Routes
router.post("/expenditures", auth, expenditureController.createExpenditure);
router.get("/expenditures", auth, expenditureController.getExpenditures);
router.get("/expenditures/expenditureType/:expenditureType", auth, expenditureController.getExpenditureByType);
router.post("/expenditures/get-date-range", auth, expenditureController.getExpendituresByDateRange);
router.patch("/expenditures/:id", auth, expenditureController.updateExpenditure);
router.delete("/expenditures/:id", auth, expenditureController.deleteExpenditure);

export default router;
