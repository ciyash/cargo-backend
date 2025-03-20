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
    grnNo: { type: Number, unique: true },            //auto  generate
    lrNumber: { type: String,required:true },             //auto  generate
    adminUniqueId: { type: Number,required:true},         //auto entered
    bookedBy: { type:mongoose.Schema.Types.ObjectId,ref:"Subadmin",required:true},  // auto entered  // employee or subadmin or accountant
    bookingTime: { type: Date, default: Date.now, required: true }, //auto entered
    fromCity: { type: String,required:true },
    toCity: { type: String,required:true },
    pickUpBranch: { type: String,required:true },
    dropBranch: { type: String,required:true },
    pickUpBranchUniqueId:{type:String,required:true},
    dropBranchUniqueId:{type:String,required:true},
    location: { type: String,require:true},
    dispatchType: { type: String },   
    bookingType: { type: String,required:true },
    totalQuantity:{type:Number,required:true},
    
    // Change these fields to an array of objects
    packages: { type: [packageSchema], default: [] },  

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
    loadingDate:{type:Date,default:null},
    unloadingDate:{type:Date,default:null},
    deliveryDate:{type:Date,default:null},

    items: { type: Number },
    bookingDate: { type: Date, default: () => new Date() },


    ltDate: { type: Date, default: () => new Date() },
    ltCity: { type: String, default: null }, 
    ltBranch: { type: String, default: null },
    ltEmployee: { type: String, default: null }, 
    deliveryEmployee: { type: String, default: null },

    cancelByUser: { type: String, default: null },
    cancelDate: { type: Date, default: null }, 
    cancelCity: { type: String, default: null },
    cancelBranch: { type: String, default: null },
    refundCharge: { type: Number, default: 0 }, 
    refundAmount: { type: Number, default: 0 }
  }, 
  { timestamps: true } 
);

bookingSchema.index({ grnNumber: 1, adminUniqueId: 1, bookingStatus: 1 });

export default mongoose.model("Booking", bookingSchema);
