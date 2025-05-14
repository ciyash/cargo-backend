import mongoose from 'mongoose';

// Expense Schema
const bankSchema = new mongoose.Schema({
  accountType: {
    type: String,
    enum: ['bank', 'creditCard'], 
  },
  accountName: {
    type: String,
    required: true
  },
  accountCode: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  },
  bankName: {
    type: String,
    required: true
  },
  ifsc: {
    type: String,
    required: true
  },
  description: {
    type: String,
    maxlength: 500
  },
  primary: {
    type: Boolean,
    default: false // Whether the account is primary or not
  }
});

// Expense Model
export default Bank = mongoose.model('Bank', bankSchema);


