import mongoose from "mongoose";

const citySchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    cityName: { type: String, required: true, trim: true },   
    state: { type: String, required: true, trim: true },
    address: {type:String},
    code:{type:String}
}, { timestamps: true });

const dispatchTypeSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    isActive:{type:Boolean,default:false}
}, { timestamps: true });

const packageTypeSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true }
}, { timestamps: true });

const assetSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    value: { type: Number, required: true }, // Changed to Number
    assetType: { type: String, required: true, trim: true },
    purchaseDate: { type: Date, required: true }
}, { timestamps: true });

const expenditureSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    name: { type: String, required: true, trim: true },
    expenditureType: { type: String, required: true, trim: true },
    value: { type: Number, required: true }, 
    expenditureStatus:{type:Number,default:0},
    date: { type: Date, required: true },
    expenditureDate:{type:Date,required:true,default:()=>new Date()},
    remarks: { type: String, trim: true }
}, { timestamps: true });  

export const City = mongoose.model("City", citySchema);
export const DispatchType = mongoose.model("DispatchType", dispatchTypeSchema);
export const PackageType = mongoose.model("PackageType", packageTypeSchema);
export const Asset = mongoose.model("Asset", assetSchema);
export const Expenditure = mongoose.model("Expenditure", expenditureSchema);
