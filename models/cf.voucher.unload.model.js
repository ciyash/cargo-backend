import mongoose from "mongoose";

const cfVoucher=new mongoose.Schema({
    companyId:{type:mongoose.Schema.Types.ObjectId,ref:"Company",required:true},
    unLoadVoucher:{type:Number,required:true},
    grnNo:[{type:Number,required:true}],
    lrNumber:[{type:String,required:true}],
    unloadBranch:{type:String,required:true},
    unLaodingDate:{type:Date,default:()=>new Date()},
    remarks:{type:String},
})
export default mongoose.model("CFVoucherUnload",cfVoucher)



    