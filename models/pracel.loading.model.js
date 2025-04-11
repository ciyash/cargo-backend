import mongoose from "mongoose";


const parcelSchema = new mongoose.Schema({  
    // auto filled
    loadingType: { type: String,enum:["offload","branchLoad"], required: true }, // Auto-filled
    vocherNoUnique: { type: Number, required: true }, // Auto-generated
    loadingBy: { type: mongoose.Schema.Types.ObjectId, ref: "Subadmin", required: true }, //auto Loading employee
    loadingDate:{type:Date,default:()=>new Date()},

    // frontend entered
    senderName:{type:String},
    vehicalNumber: { type: String, required: true },  
    driverName: { type: String,default:null },
    driverNo: { type: Number, default:null }, 
    grnNo: [{ type: Number, required: true }], 
    lrNumber: [{ type: String, required: true }],
    parcelStatus: { type: Number, default: 0 },
    remarks: { type: String, default: "" },

// optional
    // fromBookingDate: { type: Date },
    // toBookingDate: { type: Date },
    // fromCity: { type: String },
    // toCity: [{ type: String}],  
    // fromBranch: { type: String },
    // toBranch: { type: String },
    
    
});

export default mongoose.model("ParcelLoading", parcelSchema);
