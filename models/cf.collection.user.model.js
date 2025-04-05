import mongoose from "mongoose";

const userMasterSchema = new mongoose.Schema({
  country: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: Number, required: true },
  address: { type: String, required: true },
  isActive: { type: Boolean, default: false },
},
  {timestamps:true}
);
export default mongoose.model("CollectionUser", userMasterSchema);
