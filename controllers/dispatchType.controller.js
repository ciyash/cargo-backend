import { DispatchType } from '../models/multi.model.js';

 const createDispatchType = async (req, res) => {
    try {
        const { name,isActive } = req.body;

       
        if (!name) {
            return res.status(400).json({message: "Name is required" });
        }

        const newDispatchType = new DispatchType({ name,isActive });
        await newDispatchType.save();

        res.status(201).json({message: "Dispatch Type added",newDispatchType });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Get All Dispatch Types
 const getDispatchTypes = async (req, res) => {
    try {
        const dispatchTypes = await DispatchType.find();

        // Check if there are no dispatch types
        if (dispatchTypes.length === 0) {
            return res.status(404).json({ success: false, message: "No dispatch types found" });
        }

        res.status(200).json(dispatchTypes);
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Get Dispatch Type by ID
 const getDispatchTypeById = async (req, res) => {
    try {
        const { id } = req.params;
        const dispatchType = await DispatchType.findById(id);

        if (!dispatchType) {
            return res.status(404).json({ success: false, message: "Dispatch Type not found" });
        }

        res.status(200).json({ success: true, dispatchType });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Update Dispatch Type
 const updateDispatchType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name,isActive } = req.body;

        // Check if required fields are provided
        if (!name) {
            return res.status(400).json({ success: false, message: "Name is required" });
        }

        const updatedDispatchType = await DispatchType.findByIdAndUpdate(id, { name,isActive }, { new: true });

        if (!updatedDispatchType) {
            return res.status(404).json({ success: false, message: "Dispatch Type not found" });
        }

        res.status(200).json({ success: true, message: "Dispatch Type updated", dispatchType: updatedDispatchType });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// Delete Dispatch Type
 const deleteDispatchType = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedDispatchType = await DispatchType.findByIdAndDelete(id);

        if (!deletedDispatchType) {
            return res.status(404).json({ success: false, message: "Dispatch Type not found" });
        }

        res.status(200).json({ success: true, message: "Dispatch Type deleted" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export default {createDispatchType,getDispatchTypes,getDispatchTypeById,deleteDispatchType,updateDispatchType}