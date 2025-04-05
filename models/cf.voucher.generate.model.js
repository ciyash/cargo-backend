import mongoose from "mongoose";

const cfVoucher=new mongoose.Schema({
    voucherNo:{type:Number,required:true},
    fromDate:{type:Date,required:true},
    toDate:{type:Date,required:true},
    grnNo:{type:String,required:true},
    voucherType:{type:String,enum:["pending","credit","assign"]},
    creditForAgent:{type:String,required:true},
    fromBranch:{type:String,required:true},
    toBranch:{type:String,required:true},
    consignor:{type:String,required:true},
    bookingStatus: { type: Number },
    charge:{type:String,required:true},
    generateDate:{type:Date,default:()=>new Date()}
    
})
export default mongoose.model("CFVoucher",cfVoucher)