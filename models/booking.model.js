import mongoose from "mongoose";

const packageSchema = new mongoose.Schema({
  quantity: { type: Number, required: true, default: 1 },
  packageType: { type: String, required: true },
  contains: { type: Number, default: 0 },
  weight: { type: Number, required: true }, 
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required:true }
});

const bookingSchema = new mongoose.Schema(
  {  
    grnNumber: { type: Number, unique: true },            //auto  generate
    lrNumber: { type: String,required:true },             //auto  generate
    adminUniqueId: { type: Number,required:true},         //auto entered
    bookedBy: { type:mongoose.Schema.Types.ObjectId,ref:"Subadmin",required:true},  // auto entered  // employee or subadmin or accountant
    fromCity: { type: String },
    toCity: { type: String },
    pickUpBranch: { type: String },
    dropBranch: { type: String },
    location: { type: String,require:true, default: "" },
    dispatchType: { type: String }, 
    bookingType: { type: String },

    // Change these fields to an array of objects
    packages: { type: [packageSchema], default: [] },  

    vehicalNumber: { type: String },
    receiptNo: { type: Number, default: "" }, 
    eWayBillNo: { type: String },
    remarks: { type: String },

    senderName: { type: String },
    senderMobile: { 
      type: Number,   
      validate: { validator: (v) => /^\d{10}$/.test(v), message: "Invalid mobile number" }
    },
    senderAddress: { type: String },
    senderGst: { type: String, default: "" },  

    receiverName: { type: String },
    receiverMobile: { 
      type: Number, 
      validate: { validator: (v) => /^\d{10}$/.test(v), message: "Invalid mobile number" }
    },
    receiverAddress: { type: String },
    receiverGst: { type: String, default: "" },

    parcelGstAmount: { type: Number, default:0 },
    grandTotal: { type: Number, default: 0 },
    serviceCharge: { type: Number, default: 0 },
    hamaliCharge: { type: Number, default: 0 },
    doorDeliveryCharge: { type: Number, default: 0 },
    doorPickupCharge: { type: Number, default: 0 },
    valueOfGoods: { type: Number, default: 0 },
    bookingStatus: { type: Number, enum: [0, 1, 2, 3, 4, 5], default: 0 },
    items: { type: Number },
    bookingDate: { type: Date, default: () => new Date() },
    ltDate: { type: Date, default: () => new Date() },
    ltCity: { type: String, default: "" }, 
    ltBranch: { type: String, default: "" },
    ltEmployee: { type: String, default: "" }, 
    deliveryEmployee: { type: String, default: "" },

    cancelByUser: { type: String, default: "" },
    cancelDate: { type: Date, default: null }, 
    cancelCity: { type: String, default: "" },
    cancelBranch: { type: String, default: "" },

    refundCharge: { type: Number, default: 0 }, 
    refundAmount: { type: Number, default: 0 }
  }, 
  { timestamps: true } 
);

bookingSchema.index({ grnNumber: 1, adminUniqueId: 1, bookingStatus: 1 });

export default mongoose.model("Booking", bookingSchema);
