import mongoose from "mongoose";

const adminSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company", // assuming you have a Company model
      required: true,
    },
    subadminUniqueId: { type: Number, required: true }, //auto generated unique ID
    // branchId: { type: mongoose.Schema.Types.ObjectId,ref:"Branch",required:true},
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: function () {
        return this.role !== "admin"; 
      },
    },

    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: [
        "superadmin",
        "admin",
        "subadmin",
        "employee",
        "accountant",
        "superviser",
        "driver",
      ],
      required: true,
    },
    address: { type: String },
    ipAddress: { type: String },
    username: { type: String },
    phone: { type: String },
    location: { type: String },
    documents: [{ type: String }],
    otp: { type: Number },
    otpExpires: { type: Date },
    print:{type:String,default:""}
  },
  { timestamps: true }
);

export default mongoose.model("Subadmin", adminSchema);
