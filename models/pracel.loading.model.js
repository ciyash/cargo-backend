import mongoose from "mongoose";

const parcelSchema = new mongoose.Schema({  
    parcelType:{type:String,enum:["loading","unloading"]},
    vocherNoUnique:{type:Number,required:true},
    fromBranch: { type:String, required: true },
    userName:{type:String,required:true},
    toBranch: { type: String, required: true},
    unloadBranch:{type:String,default:""},
    vehicalType: { type:String, required: true }, 
    vehicalNumber:{type:String,required:true},
    driverName: { type: String, required: true },
    parcelStatus:{type:Number,default:0},
    driverNo: { type: String, required: true }, 
    fromBookingDate: { type: Date, required: true },
    toBookingDate: { type: Date, required: true },
    fromCity: { type: String, required: true },
    toCity: { type: String, required: true },
    remarks: { type: String},
    grnNo: [{ type: String, required: true}], 
    lrNumber:[{type:String,required:true}],
   
});

export default mongoose.model("ParcelLoading", parcelSchema);    
 