import mongoose from "mongoose";

const parcelSchema = new mongoose.Schema({  
    parcelType:{type:String,required:true},    // auto filled
    vocherNoUnique:{type:Number,required:true},   //auto generated
    loadingBy:{type:mongoose.Schema.Types.ObjectId,ref:"Subadmin",required:true},   //  loading employee
    loadingDate:{type:Date,required:true},  //auto entered
    fromBookingDate: { type: Date, required: true },
    toBookingDate: { type: Date, required: true },
    fromCity: { type: String, required: true },
    toCity: [{ type: String, required: true }],
    fromBranch: { type:String, required: true },
    toBranch: { type: String, required: true},
    vehicalNumber:{type:String,required:true},  
    driverName: { type: String, required: true },
    driverNo: { type: Number, required: true }, 
    grnNo: [{ type: Number, required: true}], 
    lrNumber:[{type:String,required:true}],

    parcelStatus:{type:Number,default:0},
    remarks: { type: String,default:""},

// branch to branch
    
   
});

export default mongoose.model("ParcelLoading", parcelSchema);    
 