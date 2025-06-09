import express from "express";
import expensiveController from "../controllers/expensive.controller.js";
import auth from "../config/auth.middleware.js";

const router = express.Router();

// Expense Routes
router.post("/expenses", auth, expensiveController.createExpense);        
router.get("/expenses", auth, expensiveController.getAllExpenses);       
router.get("/expenses/:id", auth, expensiveController.getExpenseById);  
router.patch("/expenses/:id", auth, expensiveController.updateExpense);   
router.delete("/expenses/:id", auth, expensiveController.deleteExpense);

// Expense Type Routes
router.post("/expense-types", auth, expensiveController.createExpenseType);   
router.get("/expense-types", auth, expensiveController.getAllExpenseTypes);   
router.get("/expense-types/:id", auth, expensiveController.getExpenseTypeById); 
router.patch("/expense-types/:id", auth, expensiveController.updateExpenseType);
router.delete("/expense-types/:id", auth, expensiveController.deleteExpenseType); 

// Account Routes
router.post("/account-cat", auth, expensiveController.createAccountCat);        
router.get("/account-cat", auth, expensiveController.getAllAccountCats);       
router.get("/account-cat/:id", auth, expensiveController.getAccountCatById);
router.patch("/account-cat/:id", auth, expensiveController.updateAccountCat);  
router.delete("/account-cat/:id", auth, expensiveController.deleteAccountCat); 

// Account Category Routes
router.post("/account-subcat", auth, expensiveController.createAccountSubCat); 
router.get("/account-subcat", auth, expensiveController.getAllAccountSubCats); 
router.get("/account-subcat/:id", auth, expensiveController.getAccountSubCatById); 
router.patch("/account-subcat/:id", auth, expensiveController.updateAccountSubCat); 
router.delete("/account-subcat/:id", auth, expensiveController.deleteAccountSubCat); 

// Customer Routes
router.post("/customers", auth, expensiveController.createCustomer);     
router.get("/customers", auth, expensiveController.getAllCustomers);     
router.get("/customers/:id", auth, expensiveController.getCustomerById); 
router.patch("/customers/:id", auth, expensiveController.updateCustomer);  
router.delete("/customers/:id", auth, expensiveController.deleteCustomer); 

export default router;
