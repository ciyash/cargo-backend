import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ["monthly", "half-yearly", "yearly"],
    default: "monthly",
  },
  validTill: {
    type: Date,
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
    default: () => new Date(),
  },
}, { _id: false });

const companySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },

  password: {
    type: String,
    required: true,
  },

  logo: {
    type:String,
    default:""
  },

  companyAccess: {
  type: Boolean,
  default: false,
},


  phone: {
    type: String,
  },

  address: {
    type: String,
  },

  state: {
    type: String,
  },

  customerName: {
    type: String,
  },

  parentCompany: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    default: null,
  },

  isBlocked: {
    type: Boolean,
    default: false,
  },

  lastLoginIp: {
    type: String,
    default: null,
  },
  bookingLimit: {
    type: Number,
    default: 1000, // or any sensible default
  },
  subscription: {
    type: subscriptionSchema,
    default: () => ({
      plan: "monthly",
      startDate: new Date(),
      validTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days later
    }),
  },

}, { timestamps: true });

const Company = mongoose.model("Company", companySchema);
export default Company;
