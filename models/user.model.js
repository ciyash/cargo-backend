import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
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