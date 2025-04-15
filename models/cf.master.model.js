import mongoose from "mongoose";

const masterSchema = new mongoose.Schema({
    gst:{type:String},
    cfMasterUnique:{type:Number,required:true},
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    code: { type: String, default:null },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }, 
    address: { type: String, required: true },
    isActive: { type: Boolean, default: false }, 
    isPostPaid: { type: Boolean, default: true },
    isAgent: { type: Boolean, default: true },
    isAllowNegativeBooking: { type: Boolean, default: false }, 
    PAN: { type: String, default:null },
    accountNo: { type: Number, default:null }, 
    ifscCode: { type: String, default:null },
    tanNo: { type: String,default:null },
    creditDaysLimit: { type: Number, default: 0 },
    exDate: { type: Date },  
    partyAccountEmail: { type: String, default:null },
    transportEmail: { type: String, default:null },
    executiveName: { type: String, default:null }  ,  

    senderName: { type: String ,default:null},
    senderMobile: { type: Number,default:null },

    receiverName: { type: String,default:null },  
    receiverMobile: { type: Number,default:null},
});

export default mongoose.model("CFMaster", masterSchema);
