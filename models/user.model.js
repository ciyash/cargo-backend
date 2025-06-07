import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
 
    {
       companyId: {type: mongoose.Schema.Types.ObjectId,ref: "Company", required: true},
      senderType:{
        type:String,
        default:"user"
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
        validate: {
          validator: (v) => /^\d{10}$/.test(v),
          message: "Invalid mobile number",
        },
      },
      address: {
        type: String,
        required: true,
        trim: true,
      },
      gst: {
        type: String,
        required: true,
        trim: true,
      },
    },
    { timestamps: true }
  );

  export default mongoose.model("User",userSchema)