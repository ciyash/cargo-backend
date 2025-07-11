import mongoose from "mongoose";

const packageSchema = new mongoose.Schema({
  quantity: { type: Number, default: 1 },
  packageType: { type: String, required: true },
  contains: { type: String, default: null },
  weight: { type: Number },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required: true },
  actulWeight: { type: String },
});

const bookingSchema = new mongoose.Schema(
  {
    grnNo: { type: Number, required: true }, //auto  generate
    lrNumber: { type: String, required: true }, //auto  generate
    adminUniqueId: { type: Number, required: true }, //auto entered
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subadmin",
      required: true,
    }, // auto entered  // employee or subadmin or accountant
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    bookbranchid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
    totalPackages: { type: Number, required: true },

    agent: { type: String, default: "" }, // agent name
    fromCity: { type: String, required: true },
    toCity: { type: String, required: true },
    pickUpBranch: { type: String, required: true },
    dropBranch: { type: String, required: true },
    pickUpBranchname: { type: String, required: true },
    dropBranchname: { type: String, required: true },
    location: { type: String, require: true },
    dispatchType: { type: String },
    bookingType: {
      type: String,
      enum: ["paid", "toPay", "credit", "FOC"],
      required: true,
    },
   toPayDeliveredAmount: {
   type: Number, 
  default: null
},


    totalQuantity: { type: Number, required: true },
    packages: { type: [packageSchema], default: [] },

    receiptNo: { type: Number, default: null },
    eWayBillNo: { type: String },
    remarks: { type: String },

    senderName: { type: String },
    senderMobile: {
      type: Number,
    },
    senderAddress: { type: String },
    senderGst: { type: String, default: null },

    receiverName: { type: String },
    receiverMobile: {
      type: Number,
    },

    receiverAddress: { type: String },
    receiverGst: { type: String, default: null },

    parcelGstAmount: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    totalCharge: { type: Number, default: 0 },
    serviceCharges: { type: Number, default: 0 },
    hamaliCharges: { type: Number, default: 0 },
    doorDeliveryCharges: { type: Number, default: 0 },
    doorPickupCharges: { type: Number, default: 0 },
    valueOfGoods: { type: Number, default: 0 },

    bookingStatus: { type: Number, enum: [0, 1, 2, 3, 4, 5], default: 0 },
    items: { type: Number },
    bookingDate: { type: Date, default: () => new Date() },
    vehicalNumber: { type: String, default: null },
    driverName: { type: String, default: null },

    // loading data
    loadingDate: { type: Date, default: null },
    loadingBranchname: { type: String, default: null },
    loadingByemp: { type: String, default: null },

    // unloading data
    unloadingDate: { type: Date, default: null },
    unloadingBranchname: { type: String, default: null },
    unloadingByemp: { type: String, default: null },

    // deleivery data
    deliveryDate: { type: Date, default: null },
    deliveryEmployee: { type: String, default: null },
    deliveryBranchName: { type: String, default: null },
    deliveryAmount: { type: Number, default: 0 },
    
    //last transactions
    ltDate: { type: Date, default: () => new Date() },
    ltCity: { type: String, default: null },
    ltBranch: { type: String, default: null },
    // ltBranchName: { type: String, default: null },
    ltEmployee: { type: String, default: null },

    cancelDate: { type: Date, default: null },
    cancelByUser: { type: String, default: null },
    cancelCity: { type: String, default: null },
    cancelBranch: { type: String, default: null },
    refundAmount:{type:Number,default:0},
   
//  missing  data
    missingDate: { type: Date, default: null },
    missingByUser: { type: String, default: null },
    missingReason: { type: String, default: null },

  },


  { timestamps: true }
);

// bookingSchema.index({ grnNo: 1, adminUniqueId: 1, bookingStatus: 1 });
bookingSchema.index({ companyId: 1, grnNo: 1 }, { unique: true });

const userSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  gst: { type: String, required: null },
});

const deliverySchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: true,
  },
   grnNo: { type: Number, required: true }, // auto generate
   receiverName: { type: String, required: true },
   receiverMobile: { type: String, required: true },
   deliveryAmount:{type:Number,required:true},
   deliveryDate: { type: Date, required: true },
   deliveryEmployee: { type: String, default: null },
   deliveryBranchName: { type: String, default: null },
});

const User = mongoose.model("User", userSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Delivery = mongoose.model("Delivery", deliverySchema);
export { User, Booking, Delivery };
