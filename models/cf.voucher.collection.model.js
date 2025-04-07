import mongoose from "mongoose";

const voucherCollection=new mongoose.Schema({
fromDate:{type:String,required:true},
toDate:{type:String,required:true},
agent:{type:String,required:true},
voucherNo:{type:String,required:true},
voucherType:{type:String,required:true},
grnNo:[{type:Number,required:true}],
user:{type:String}
})
export default mongoose.model("Vouchercollection",voucherCollection)