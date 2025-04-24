import mongoose from "mongoose";
 
const packageSchema = new mongoose.Schema({
  quantity: { type: Number, default: 1 },
  packageType: { type: String, required: true },
  contains: { type: String, default:null},
  weight: { type: Number },
  unitPrice: { type: Number, required: true },
  totalPrice: { type: Number, required:true },
  actulWeight:{type:String,default:0}
});
 
const bookingSchema = new mongoose.Schema( 
  {  
    grnNo: { type: Number, unique: true },                //auto  generate
    lrNumber: { type: String,required:true },             //auto  generate
    adminUniqueId: { type: Number,required:true},         //auto entered
    bookedBy: { type:mongoose.Schema.Types.ObjectId,ref:"Subadmin",required:true},  // auto entered  // employee or subadmin or accountant
  
    bookbranchid: {type: mongoose.Schema.Types.ObjectId,ref: "Branch", required: true},
    fromCity: { type: String,required:true },
    toCity: { type: String,required:true },
    pickUpBranch: { type: String,required:true },
    dropBranch: { type: String,required:true },
    pickUpBranchname: { type: String,required:true },
    dropBranchname: { type: String,required:true },
    location: { type: String,require:true},
    dispatchType: { type: String },  
    bookingType: { type: String,required:true },
    totalQuantity:{type:Number,required:true},
   
    packages: { type: [packageSchema], default: [] },  
 
    receiptNo: { type: Number, default: null },
    eWayBillNo: { type: String },
    remarks: { type: String },
 
    senderName: { type: String },
    senderMobile: {
      type: Number
    },
    senderAddress: { type: String },
    senderGst: { type: String, default: null },  
 
    receiverName: { type: String },  
    receiverMobile: {
      type: Number
    },
    receiverAddress: { type: String },
    receiverGst: { type: String, default: null },
 
    parcelGstAmount: { type: Number, default:0 },
    grandTotal: { type: Number, default: 0 },
    serviceCharge: { type: Number,required:true },
    hamaliCharge: { type: Number,required:true },
    doorDeliveryCharge: { type: Number,required:true },  
    doorPickupCharge: { type: Number,required:true},
    valueOfGoods: { type: Number,required:true },

        
    bookingStatus: { type: Number, enum: [0, 1, 2, 3, 4, 5], default: 0 },
    items: { type: Number },
    bookingDate: { type: Date, default: () => new Date() },
    vehicalNumber:{type:String,default:null},
 
   // loading data
    loadingDate:{type:Date,default:null},
    loadingBranchname:{type:String,default:null},
    loadingByemp:{type:String,default:null},

   // unloading data
    unloadingDate:{type:Date,default:null},
    unloadingBranchname:{type:String,default:null},
    unloadingByemp:{type:String,default:null},

    // deleivery data
    deliveryDate:{type:Date,default:null},
    deliveryEmployee: { type: String, default: null },
    deliveryBranchName:{type:String,default:null},

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
    refundCharge: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 },

  },




  { timestamps: true }
);
 
bookingSchema.index({ grnNumber: 1, adminUniqueId: 1, bookingStatus: 1 });
 
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true ,unique: true},
  address: { type: String },
  gst: { type: String, required: null }
});
 
const User = mongoose.model("User", userSchema);
const Booking = mongoose.model("Booking", bookingSchema);
export { User, Booking };
 
 