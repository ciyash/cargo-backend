import {  Expense, ExpenseType, Customer,  AccountCat,  AccountSubCat} from '../models/expensive.model.js'; // adjust path if needed

const createExpense = async (req, res) => {
  try {
    const {
      branchId,
      expenseDate,
      expenseType,
      amount,
      paidThrough,
      invoice,
      notes
    } = req.body;

    const newExpense = new Expense({
      branchId,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      expenseType,
      amount,
      paidThrough,
      invoice,
      notes
    });

    await newExpense.save();
    res.status(201).json({ message: "Expense created successfully", data: newExpense });
  } catch (error) {
    res.status(400).json({ message: "Failed to create expense", error: error.message });
  }
};

const getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find()
    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch expenses", error: error.message });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    res.status(200).json(expense);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch expense", error: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Expense not found" });
    res.status(200).json({ message: "Expense updated", data: updated });
  } catch (error) {
    res.status(400).json({ message: "Failed to update expense", error: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const deleted = await Expense.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Expense not found" });
    res.status(200).json({ message: "Expense deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete expense", error: error.message });
  }
};

// ─── ExpenseType CRUD ──────────────────────────────────────────────────────────
const createExpenseType = async (req, res) => {
  try {
    const newType = new ExpenseType(req.body);
    await newType.save();
    res.status(201).json({ message: "ExpenseType created", data: newType });
  } catch (error) {
    res.status(400).json({ message: "Failed to create ExpenseType", error: error.message });
  }
};

const getAllExpenseTypes = async (req, res) => {
  try {
    const types = await ExpenseType.find().sort({ accountType: 1 });
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch ExpenseTypes", error: error.message });
  }
};

const getExpenseTypeById = async (req, res) => {
  try {
    const type = await ExpenseType.findById(req.params.id);
    if (!type) return res.status(404).json({ message: "ExpenseType not found" });
    res.status(200).json(type);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch ExpenseType", error: error.message });
  }
};

const updateExpenseType = async (req, res) => {
  try {
    const updated = await ExpenseType.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "ExpenseType not found" });
    res.status(200).json({ message: "ExpenseType updated", data: updated });
  } catch (error) {
    res.status(400).json({ message: "Failed to update ExpenseType", error: error.message });
  }
};

const deleteExpenseType = async (req, res) => {
  try {
    const deleted = await ExpenseType.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "ExpenseType not found" });
    res.status(200).json({ message: "ExpenseType deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete ExpenseType", error: error.message });
  }
};

// ─── Customer CRUD ─────────────────────────────────────────────────────────────
const createCustomer = async (req, res) => {
  try {
    const cust = new Customer(req.body);
    await cust.save();
    res.status(201).json({ message: "Customer created", data: cust });
  } catch (error) {
    res.status(500).json({ message: "Failed to create customer", error: error.message });
  }
};

const getAllCustomers = async (req, res) => {
  try {
    const list = await Customer.find();
    res.status(200).json(list);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch customers", error: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const cust = await Customer.findById(req.params.id);
    if (!cust) return res.status(404).json({ message: "Customer not found" });
    res.status(200).json(cust);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch customer", error: error.message });
  }
};  

const updateCustomer = async (req, res) => {
  try {
    const updated = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Customer not found" });
    res.status(200).json({ message: "Customer updated", data: updated });
  } catch (error) {
    res.status(400).json({ message: "Failed to update customer", error: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const deleted = await Customer.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Customer not found" });
    res.status(200).json({ message: "Customer deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete customer", error: error.message });
  }
};

// ─── AccountCat CRUD ───────────────────────────────────────────────────────────
const createAccountCat = async (req, res) => {
  try {
    const cat = new AccountCat(req.body);
    await cat.save();
    res.status(201).json({ message: "AccountCat created", data: cat });
  } catch (error) {
    res.status(500).json({ message: "Failed to create AccountCat", error: error.message });
  }
};

const getAllAccountCats = async (req, res) => {
  try {
    const cats = await AccountCat.find();
    res.status(200).json(cats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch AccountCats", error: error.message });
  }
};

const getAccountCatById = async (req, res) => {
  try {
    const cat = await AccountCat.findById(req.params.id);
    if (!cat) return res.status(404).json({ message: "AccountCat not found" });
    res.status(200).json(cat);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch AccountCat", error: error.message });
  }
};

const updateAccountCat = async (req, res) => {
  try {
    const updated = await AccountCat.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "AccountCat not found" });
    res.status(200).json({ message: "AccountCat updated", data: updated });
  } catch (error) {
    res.status(400).json({ message: "Failed to update AccountCat", error: error.message });
  }
};

const deleteAccountCat = async (req, res) => {
  try {
    const deleted = await AccountCat.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "AccountCat not found" });
    res.status(200).json({ message: "AccountCat deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete AccountCat", error: error.message });
  }
};

// ─── AccountSubCat CRUD ────────────────────────────────────────────────────────
const createAccountSubCat = async (req, res) => {
  try {
    const sub = new AccountSubCat(req.body);
    await sub.save();
    res.status(201).json({ message: "AccountSubCat created", data: sub });
  } catch (error) {
    res.status(500).json({ message: "Failed to create AccountSubCat", error: error.message });
  }
};

const getAllAccountSubCats = async (req, res) => {
  try {
    const subs = await AccountSubCat.find().populate('category','name');
    res.status(200).json(subs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch AccountSubCats", error: error.message });
  }
};

const getAccountSubCatById = async (req, res) => {
  try {
    const sub = await AccountSubCat.findById(req.params.id).populate('category','name');
    if (!sub) return res.status(404).json({ message: "AccountSubCat not found" });
    res.status(200).json(sub);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch AccountSubCat", error: error.message });
  }
};

const updateAccountSubCat = async (req, res) => {
  try {
    const updated = await AccountSubCat.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "AccountSubCat not found" });
    res.status(200).json({ message: "AccountSubCat updated", data: updated });
  } catch (error) {
    res.status(400).json({ message: "Failed to update AccountSubCat", error: error.message });
  }
};

const deleteAccountSubCat = async (req, res) => {
  try {
    const deleted = await AccountSubCat.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "AccountSubCat not found" });
    res.status(200).json({ message: "AccountSubCat deleted" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete AccountSubCat", error: error.message });
  }
};

export default {
  // Expense
  createExpense, getAllExpenses, getExpenseById, updateExpense, deleteExpense,
  // ExpenseType
  createExpenseType, getAllExpenseTypes, getExpenseTypeById, updateExpenseType, deleteExpenseType,
  // Customer
  createCustomer, getAllCustomers, getCustomerById, updateCustomer, deleteCustomer,
  // AccountCat
  createAccountCat, getAllAccountCats, getAccountCatById, updateAccountCat, deleteAccountCat,
  // AccountSubCat
  createAccountSubCat, getAllAccountSubCats, getAccountSubCatById, updateAccountSubCat, deleteAccountSubCat
};
