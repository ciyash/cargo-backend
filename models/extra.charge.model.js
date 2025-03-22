import mongoose from "mongoose";

const chargeSchema = new mongoose.Schema({
    fromCity: { type: String, required: true },
    toCity: { type: String, required: true },
    GST: { type: String, required: false }, 
    serviceCharge: { type: Number, required: true },
    loadingCharge: { type: Number, required: true },
    cartageCharge: { type: Number, required: true },
    isActive: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Charge", chargeSchema);
