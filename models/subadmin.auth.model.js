import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    subadminUniqueId: { type: Number, required: true }, 
    branchId: { type: mongoose.Schema.Types.ObjectId,ref:"Branch",required:true },  
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["subadmin", "employee"], required: true },
    ipAddress: { type: String },
    username: { type: String},
    phone: { type: String},     
  
    branchName: { type: String },  
    location: { type: String },  
    documents: { type: String },
    otp: { type: Number  },  
    otpExpires: { type: Date }, 
  },
  { timestamps: true }
);

export default mongoose.model("Subadmin", adminSchema);  
  