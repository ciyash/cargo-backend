import mongoose from "mongoose";

const branchSchema = new mongoose.Schema({
    branchUniqueId:{type:String,required:true}, 
    openingBalance:{type:Number,default:0}, 
    createdBy: { type:mongoose.Schema.Types.ObjectId,ref:'Subadmin',required:true},
    branchType:{type:String,enum:["main","normal"],default:"normal"},
    name:{type:String,required:true},
    city:{type:String,required:true},
    address:{type:String,required:true},
    location:{type:String,required:true},
    phone: { type: Number, required: true },       
    email:{type:String,required:true},
    pincode: { type: Number, required: true },  
    state: { type: String, required: true },   
    country: { type: String, required: true },  
    alternateMobile: { type: Number }, 
    branchDate: { type: Date, default: () => new Date() }, 
    branchStatus: { type:Number, default: 0 } 
});

export default mongoose.model("Branch", branchSchema);
       