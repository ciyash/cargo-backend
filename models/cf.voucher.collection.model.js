import mongoose from "mongoose";

const voucherCollection=new mongoose.Schema({
admin:{type:mongoose.Schema.Types.ObjectId,ref:'Subadmin',required:true},
fromDate:{type:String,required:true},
toDate:{type:String,required:true},
agent:{type:String,required:true},
voucherNo:[{type:String,required:true}],
voucherType:{type:String,required:true},
grnNo:[{type:Number,required:true}],
})
export default mongoose.model("Vouchercollection",voucherCollection)