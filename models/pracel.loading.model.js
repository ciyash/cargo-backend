import mongoose from "mongoose";

const branchTobranchSchema = new mongoose.Schema({
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    branch: { type: String, required: true },
    vehicleNo: { type: String, required: true },
    unLoadBranch: { type: String, required: true },
    remark: { type: String, default: "" }
});

const parcelSchema = new mongoose.Schema({  
    parcelType: { type: String, required: true }, // Auto-filled
    vocherNoUnique: { type: Number, required: true }, // Auto-generated
    loadingBy: { type: mongoose.Schema.Types.ObjectId, ref: "Subadmin", required: true }, // Loading employee
    fromBookingDate: { type: Date, required: true },
    toBookingDate: { type: Date, required: true },
    fromCity: { type: String, required: true },
    toCity: [{ type: String, required: true }],
    fromBranch: { type: String, required: true },
    toBranch: { type: String, required: true },
    vehicalNumber: { type: String, required: true },  
    driverName: { type: String, required: true },
    driverNo: { type: Number, required: true }, 
    grnNo: [{ type: Number, required: true }], 
    lrNumber: [{ type: String, required: true }],
    parcelStatus: { type: Number, default: 0 },
    remarks: { type: String, default: "" },
    
    // Adding branchToBranch as an array of subdocuments
    branchTobranch: [branchTobranchSchema] 
});

export default mongoose.model("ParcelLoading", parcelSchema);
