import mongoose from "mongoose";

const termsSchema=new mongoose.Schema({
    companyId:{type:mongoose.Schema.Types.ObjectId,ref:"CFMaster"},
    title:{type:String,required:true},
    descritption:{type:String,required:true}
})
export default mongoose.model("Terms",termsSchema)