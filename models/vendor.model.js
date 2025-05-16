import mongoose from "mongoose";

const vendorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  companyName: {
    type: String,
    default: "",
  },
  displayName: {
    type: String,
    default: "",
  },
  address: {
    type: String,
    default: "",
  },
  workPhone: {
    type: String,
    default: "",
  },
  mobile: {
    type: String,
    default: "",
  },
  bankDetails: {
    accountNumber: {
      type: String,
      default: "",
    },
    accountName: {
      type: String,
      default: "",
    },
    bankName: {
      type: String,
      default: "",
    },
    branchName: {
      type: String,
      default: "",
    },
    ifscCode: {
      type: String,
      default: "",
    },
  },
});

export default mongoose.model("Vendor", vendorSchema);
