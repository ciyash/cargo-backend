import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema({
  branchId: { type:String ,required: true },
  expenseDate: { type: Date, default: () => new Date() },
  expenseType: { type: String, required: true },
  amount: { type: Number, required: true },
  paidThrough: { type: String, required: true },
  invoice: { type: String, required: true },
  notes: { type: String, required: true },

}, {
  timestamps: true,
});

const ExpenseTypeSchema = new mongoose.Schema({
  accountType: { type: String, required: true },
  accountName: { type: String, required: true },
  accountCode: { type: String },
  description: { type: String },
  isActive: { type: Boolean, default: false },
}, {
  timestamps: true,
});

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: Number },
}, {
  timestamps: true,
});

const AccountCatSchema = new mongoose.Schema({
  name: { type: String, required: true }
}, {
  timestamps: true,
});

const AccountSubCatSchema = new mongoose.Schema({
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'AccountCat', required: true },
  name: { type: String, required: true }
}, {
  timestamps: true,
});

export const AccountCat = mongoose.model('AccountCat', AccountCatSchema);
export const AccountSubCat = mongoose.model('AccountSubCat', AccountSubCatSchema);
export const Expense = mongoose.model("Expense", ExpenseSchema);
export const ExpenseType = mongoose.model("ExpenseType", ExpenseTypeSchema);
export const Customer = mongoose.model("Customer", CustomerSchema);
