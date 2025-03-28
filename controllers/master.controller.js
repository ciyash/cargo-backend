import Master from '../models/master.model.js' 

 const createMaster = async (req, res) => {
    try {
        const {
            GST, country, state, city, code, name, email, phone, address, senderName,
            senderMobile, PAN, accountNo, ifscCode, tanNo, partyAccountEmail,
            transportEmail, executiveName
        } = req.body;

        const newMaster = new Master({
            GST, country, state, city, code, name, email, phone, address, senderName,
            senderMobile, PAN, accountNo, ifscCode, tanNo, partyAccountEmail,
            transportEmail, executiveName
        });


        await newMaster.save();

        res.status(201).json({ message: "Master record created successfully",  newMaster });
    } catch (error) {
        res.status(500).json({error: error.message });
    }
};

 const getAllMasters = async (req, res) => {
    try {
        const masters = await Master.find();
        res.status(200).json({data: masters });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


 const getMasterById = async (req, res) => {
    try {
        const master = await Master.findById(req.params.id);
        if (!master) {
            return res.status(404).json({ success: false, message: "Master record not found" });
        }
        res.status(200).json({ success: true, data: master });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update a master record by ID
 const updateMaster = async (req, res) => {
    try {
        const updatedMaster = await Master.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

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
        const deletedMaster = await Master.findByIdAndDelete(req.params.id);

        if (!deletedMaster) {
            return res.status(404).json({ success: false, message: "Master record not found" });
        }

        res.status(200).json({ success: true, message: "Master record deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export default {createMaster,getAllMasters,getMasterById,deleteMaster,updateMaster}
