import mongoose from "mongoose";  

const unloadingSchema=new mongoose.Schema({  
    unLoadingBy:{type:mongoose.Schema.Types.ObjectId,ref:"Subadmin",required:true},  //auto fill
    unLoadingVoucher:{type:Number,required:true},  // auto generated
    fromBookingDate:{type:Date,required:true},
    toBookingDate:{type:Date,required:true},
    fromCity:[{type:String,required:true}],
    toCity:{type:String,required:true},
    branch:{type:String,required:true},
    bookingType:{type:String,default:""},
    vehicleNo:{type:String,required:false},  
    lrNumber:[{type:String,required:true}],
    grnNo:[{type:Number,required:true}]
})
 
export default mongoose.model("ParcelUnloading",unloadingSchema)   