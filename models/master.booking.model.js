import mongoose from "mongoose";

const masterSchema = new mongoose.Schema({
    fromBranch:{type:String,required:true},
    toBranch:{type:String,required:true},
    fromBranchName:{type:String,required:true},
    toBranchName:{type:String,required:true},
    bookbranchid:{type:String,required:true},
    grnNo:{type:String,required:true},
    GST: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    code: { type: String, default:null },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }, 
    address: { type: String, required: true },
    bookingStatus: { type: Number, enum: [0, 1, 2, 3, 4, 5], default: 0 },
    totalAmount:{type:Number,required:true},
    senderName: { type: String, required: true, trim: true },
    senderMobile: { type: String, required: true, trim: true },  
    isActive: { type: Boolean, default: false }, 
    
    receiverName: { type: String }, 
    receiverMobile: { type: Number }, 
    isPostPaid: { type: Boolean, default: false },
    isAgent: { type: Boolean, default: false },
    isAllowNegativeBooking: { type: Boolean, default: false }, 
    postPaidRole: { type: String }, 
    masterBookingDate:{type:Date,required:true},
    PAN: { type: String, required: true },
    accountNo: { type: Number, required: true }, 
    ifscCode: { type: String, required: true },
    tanNo: { type: String, required: true },
    creditDaysLimit: { type: Number, default: 0 },
    exDate: { type: Date },
    partyAccountEmail: { type: String, required: true },
    transportEmail: { type: String, required: true },
    executiveName: { type: String, required: true } 
});

export default mongoose.model("Masterbooking", masterSchema);
