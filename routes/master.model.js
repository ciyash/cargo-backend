import mongoose from "mongoose";

const masterSchema = new mongoose.Schema({
    GST: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    code: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },  // Changed to String for flexibility
    address: { type: String, required: true },

    senderName: { type: String, required: true, trim: true },
    senderMobile: { type: String, required: true, trim: true },  // Changed to String
    isActive: { type: Boolean, default: false },  // Matches "Is Active" checkbox
    
    receiverName: { type: String },  // Made optional
    receiverMobile: { type: Number },  // Made optional
    isPostPaid: { type: Boolean, default: false },
    postPaidRole: { type: String }, // Optional field if role is selectable

    PAN: { type: String, required: true },
    accountNo: { type: String, required: true },  // Changed to String
    ifscCode: { type: String, required: true },
    tanNo: { type: String, required: true },
    creditDaysLimit: { type: Number, default: 0 },
    exDate: { type: Date },
    partyAccountEmail: { type: String, required: true },
    transportEmail: { type: String, required: true },
    executiveName: { type: String, required: true }  // Fixed typo
});

export default mongoose.model("Master", masterSchema);
