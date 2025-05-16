import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['Goods', 'Service'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  unit: {
    type: String,
    default: ''
  },
  salesInfo: {
    sellingPrice: {
      type: Number,
      required: true
    },
    account: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    }
  },
  purchaseInfo: {
    costPrice: {
      type: Number,
      required: true
    },
    account: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ''
    },
    preferredVendor: {
      type: String,
      default: ''
    }
  }
}, {
  timestamps: true
});

export default mongoose.model('Item', itemSchema);
