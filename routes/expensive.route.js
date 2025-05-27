import express from "express";
import expensiveController from "../controllers/expensive.controller.js";

const router = express.Router();

// Expense Routes
router.post("/expenses", expensiveController.createExpense);        
router.get("/expenses", expensiveController.getAllExpenses);       
router.get("/expenses/:id", expensiveController.getExpenseById);  
router.patch("/expenses/:id", expensiveController.updateExpense);   
router.delete("/expenses/:id", expensiveController.deleteExpense);

// Expense Type Routes
router.post("/expense-types", expensiveController.createExpenseType);   
router.get("/expense-types", expensiveController.getAllExpenseTypes);   
router.get("/expense-types/:id", expensiveController.getExpenseTypeById); 
router.patch("/expense-types/:id", expensiveController.updateExpenseType);
router.delete("/expense-types/:id", expensiveController.deleteExpenseType); 

// Account Routes
router.post("/account-cat", expensiveController.createAccountCat);        
router.get("/account-cat", expensiveController.getAllAccountCats);       
router.get("/account-cat/:id", expensiveController.getAccountCatById);
router.patch("/account-cat/:id", expensiveController.updateAccountCat);  
router.delete("/account-cat/:id", expensiveController.deleteAccountCat); 

// Account Category Routes
router.post("/account-subcat", expensiveController.createAccountSubCat); 
router.get("/account-subcat", expensiveController.getAllAccountSubCats); 
router.get("/account-subcat/:id", expensiveController.getAccountSubCatById); 
router.patch("/account-subcat/:id", expensiveController.updateAccountSubCat); 
router.delete("/account-subcat/:id", expensiveController.deleteAccountSubCat); 

// Customer Routes
router.post("/customers", expensiveController.createCustomer);     
router.get("/customers", expensiveController.getAllCustomers);     
router.get("/customers/:id", expensiveController.getCustomerById); 
router.patch("/customers/:id", expensiveController.updateCustomer);  
router.delete("/customers/:id", expensiveController.deleteCustomer); 

export default router;
