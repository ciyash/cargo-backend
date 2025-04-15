import mongoose from "mongoose";

const masterSchema = new mongoose.Schema({
    gst:{type:String},
    country: { type: String, required: false },
    state: { type: String, required: false },
    city: { type: String, required: false },
    code: { type: String, default:null },
    name: { type: String, required: false },
    email: { type: String, required: false },
    phone: { type: String, required: false }, 
    address: { type: String, required: false },
    isActive: { type: Boolean, default: false }, 
    isPostPaid: { type: Boolean, default: false },
    isAgent: { type: Boolean, default: false },
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
