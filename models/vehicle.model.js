import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema({
    vehicleNo: { type: String, required: true, trim: true, unique: true },
    vehicleType: { type: String, required: true, trim: true },
    registrationNo: { type: String, required: true, trim: true, unique: true },
    date: { type: Date, required: true },
    RC: { type: String, required: true, trim: true },
    polutionExpDate: { type: Date, required: true },
    fuelType: { type: String, required: true, trim: true, uppercase: true },
    branch: { type:String, required: true },
    vehicleStatus:{type:String,enum:['active','inactive'],default:"active"}
}, { timestamps: true });

export default mongoose.model("Vehical", vehicleSchema);
