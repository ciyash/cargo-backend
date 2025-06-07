import mongoose from "mongoose";

const cfExtraCharge=new mongoose.Schema({
    companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",required:true},
 agentName:{type:mongoose.Schema.Types.ObjectId,ref:"Masterbooking",required:true},
 chargeName:{type:String,required:true},
 fromCity:{type:String,required:true},
 toCity:{type:String,required:true},
 charge:{type:Number,default:0},
 modeOnPrice:{type:String,required:true},
 itemName:{type:String,default:null},
 dispatchType:{type:String,default:null},
 isActive:{type:Boolean,default:true}
})
export default mongoose.model("CFExtraCharge",cfExtraCharge)