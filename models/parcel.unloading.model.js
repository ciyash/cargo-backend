import mongoose from "mongoose";

const unloadingSchema=new mongoose.Schema({
    unLoadingBy:{type:mongoose.Schema.Types.ObjectId,ref:"Subadmin"},
    unLoadingVoucher:{type:Number,required:true},
    fromBookingDate:{type:Date,required:true},
    toBookingDate:{type:Date,required:true},
    fromCity:{type:String,required:true},
    toCity:{type:String,required:true},
    branch:{type:String,required:true},
    vehicleNo:{type:String,required:true},
    grnNo:[{type:Number,required:true}]
})

export default mongoose.model("ParcelUnloading",unloadingSchema)