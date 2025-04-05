import Masterbooking from '../models/master.booking.model.js' 
import Branch from '../models/branch.model.js'


const grnNumber = async (senderName) => {
    try {
        const companyName = "SK";
        const currentYear = new Date().getFullYear();
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0"); // Ensures 2-digit month

        // Extract the first letter from the first two words in senderName
        const words = senderName.split(" ").filter(word => word.length > 0); // Remove extra spaces
        const senderCode = words.slice(0, 2).map(word => word.charAt(0)).join("").toUpperCase();

        // Fetch latest GRN Number and increment sequence
        const lastMaster = await Masterbooking.findOne().sort({ grnNo: -1 }).lean();
        const sequence = lastMaster ? parseInt(lastMaster.grnNo.split("/").pop(), 10) + 1 : 1;
        const formattedSequence = String(sequence).padStart(3, "0"); // Ensures 3-digit sequence

        // Final grnNo format: "SKHP/04/2025/001"
        return `${companyName}${senderCode}/${currentMonth}/${currentYear}/${formattedSequence}`;
    } catch (error) {
        throw new Error("Failed to generate GRN number");
    }
};
  
const createMasterBooking = async (req, res) => {
    try {
        const {
            fromBranch, toBranch, GST, country, state, city, code, name, email, phone, address, senderName,
            senderMobile, PAN, accountNo, ifscCode, tanNo, partyAccountEmail,
            transportEmail, executiveName,totalAmount
        } = req.body;

        // Generate GRN Number
        const grnNo = await grnNumber(senderName);
        const masterBookingDate = new Date();

        // Fetch Branch Names
        const [fromBranchData, toBranchData] = await Promise.all([
            Branch.findOne({ branchUniqueId: fromBranch }).lean(),
            Branch.findOne({ branchUniqueId: toBranch }).lean(),
        ]);

        if (!fromBranchData || !toBranchData) {
            return res.status(404).json({ message: "Invalid branch provided" });
        }

        const fromBranchName = fromBranchData.name;
        const toBranchName = toBranchData.name;

        // Create Master Record
        const newMaster = new Masterbooking({
            fromBranch, toBranch, grnNo, masterBookingDate,bookbranchid:req.user.branchId, GST, country, state, city, code, name, email, phone, address, senderName,
            senderMobile, PAN, accountNo, ifscCode, tanNo, partyAccountEmail,
            transportEmail, executiveName,totalAmount,
            fromBranchName, toBranchName 
        });

        await newMaster.save();

        res.status(201).json({ message: "Master record created successfully", newMaster });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.message });
    }
}; 

 const getAllMasters = async (req, res) => {
    try {
        const masters = await Masterbooking.find();
        res.status(200).json(masters);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


const getMasterSenderName = async (req, res) => {
    try {
        const { senderName } = req.params; // Get senderName from route params

        // Find records where senderName contains the given text (case-insensitive)
        const masters = await Masterbooking.find({ senderName: { $regex: senderName, $options: "i" } });

        if (masters.length === 0) {
            return res.status(404).json({ success: false, message: "No master records found for this sender name" });
        }

        res.status(200).json({data: masters });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};



// Update a master record by ID
 const updateMaster = async (req, res) => {
    try {
        const updatedMaster = await Masterbooking.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        if (!updatedMaster) {
            return res.status(404).json({ success: false, message: "Master record not found" });
        }

        res.status(200).json({ success: true, message: "Master record updated successfully", data: updatedMaster });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete a master record by ID  
 const deleteMaster = async (req, res) => {
    try {
        const deletedMaster = await Masterbooking.findByIdAndDelete(req.params.id);

        if (!deletedMaster) {
            return res.status(404).json({ success: false, message: "Master record not found" });
        }

        res.status(200).json({ success: true, message: "Master record deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};





export default {
createMasterBooking,
getAllMasters,
getMasterSenderName,
deleteMaster,
updateMaster,

}
