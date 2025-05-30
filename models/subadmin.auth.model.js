import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {  
    subadminUniqueId: { type: Number, required: true }, //auto generated unique ID
    branchId: { type: mongoose.Schema.Types.ObjectId,ref:"Branch",required:true},  //auto generated unique ID
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["superadmin","admin","subadmin", "employee","accountant","superviser","driver"], required: true },
    companyName:{type:String,default:"Sree Kaleswari Logistics"},
    address:{type:String},
    ipAddress: { type: String },
    username: { type: String},
    phone: { type: String},      
    location: { type: String },  
    documents: [{ type: String }],
    otp: { type: Number  },    
    otpExpires: { type: Date }, 
  },
  { timestamps: true }
);

export default mongoose.model("Subadmin", adminSchema);     