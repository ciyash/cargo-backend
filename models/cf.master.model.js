import mongoose from "mongoose";

const masterSchema = new mongoose.Schema({
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    code: { type: String, default:null },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true }, 
    address: { type: String, required: true },
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
    partyAccountEmail: { type: String, required: true },
    transportEmail: { type: String, required: true },
    executiveName: { type: String, required: true }    
});

export default mongoose.model("CFMaster", masterSchema);
