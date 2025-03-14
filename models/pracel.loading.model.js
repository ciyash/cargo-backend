import mongoose from "mongoose";

const parcelSchema = new mongoose.Schema({  
    parcelType:{type:String,required:true},  
    vocherNoUnique:{type:Number,required:true},   //auto generated
    fromBookingDate: { type: Date, required: true },
    toBookingDate: { type: Date, required: true },
    fromCity: { type: String, required: true },
    toCity: [{ type: String, required: true }],
    fromBranch: { type:String, required: true },
    toBranch: { type: String, required: false},
    loadingDate:{type:Date,required:true},
    loadingBy:{type:mongoose.Schema.Types.ObjectId,ref:"Subadmin",required:true},   //  loading employee
    
    vehicalNumber:{type:String,required:true},  
    driverName: { type: String, required: true },
    driverNo: { type: Number, required: true }, 
    vehicalType: { type:String,default:"" }, 
    parcelStatus:{type:Number,default:0},
    remarks: { type: String,default:""},
    grnNo: [{ type: Number, required: true}], 
    lrNumber:[{type:String,required:true}],
   
});

export default mongoose.model("ParcelLoading", parcelSchema);    
 