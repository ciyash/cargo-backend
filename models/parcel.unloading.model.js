import mongoose from "mongoose";  

const unloadingSchema=new mongoose.Schema({  
    // auto filled
    unLoadingBy:{type:mongoose.Schema.Types.ObjectId,ref:"Subadmin",required:true},  //auto fill
    companyId: {type: mongoose.Schema.Types.ObjectId,ref: "Company", required: true}, //auto fill
    unLoadingVoucher:{type:Number,required:true},  // auto generated
    unloadingDate:{type:Date,default:()=>new Date()},   // auto filled
    bookingStatus:{type:String,default:null},  
    
    bookingType:{type:String,default:""},
    vehicleNo:{type:String,required:false},  
    lrNumber:[{type:String,required:true}],
    grnNo:[{type:Number,required:true}],
    unloadBranch:{type:String},
    remarks:{type:String},
})
 
export default mongoose.model("ParcelUnloading",unloadingSchema)   