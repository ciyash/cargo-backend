import mongoose from "mongoose";


const parcelSchema = new mongoose.Schema({  
    loadingType: [{ type: String,enum:["offload","branchload"], required: true }], // Auto-filled
    vocherNoUnique: { type: Number, required: true }, // Auto-generated
    loadingBy: { type: mongoose.Schema.Types.ObjectId, ref: "Subadmin", required: true }, // Loading employee
    fromBookingDate: { type: Date, required: true },
    toBookingDate: { type: Date, required: true },
    fromCity: { type: String },
    toCity: [{ type: String}],
    fromBranch: { type: String, required: true },
    toBranch: { type: String, required: true },
    vehicalNumber: { type: String, required: true },  
    driverName: { type: String,default:null },
    driverNo: { type: Number, default:null }, 
    grnNo: [{ type: Number, required: true }], 
    lrNumber: [{ type: String, required: true }],
    parcelStatus: { type: Number, default: 0 },
    remarks: { type: String, default: "" },
    
});

export default mongoose.model("ParcelLoading", parcelSchema);
