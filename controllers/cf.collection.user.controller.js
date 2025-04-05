import CollectionUser from "../models/cf.collection.user.model.js";

// Create a new CF Collection User
const createCFCollectionUser = async (req, res) => {
    try {
        const { country, state, city, name, email, phone, address, isActive } = req.body;

        const existingUser = await CollectionUser.findOne({ 
            $or: [{ email }, { phone }] 
        });

        if (existingUser) {
            return res.status(400).json({ message: "Email or Phone already exists" });
        }

        if (!country || !state || !city || !name || !email || !phone || !address) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const newUser = new CollectionUser({ country, state, city, name, email, phone, address, isActive });

        await newUser.save();

        res.status(201).json({ success: true, message: "CF Collection User created successfully", data: newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Get all CF Collection Users
const getAllCFCollectionUsers = async (req, res) => {
    try {
        const users = await CollectionUser.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Update CF Collection User by ID
const updateCFCollectionUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const updatedUser = await CollectionUser.findByIdAndUpdate(id, updates, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, message: "CF Collection User updated successfully", data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Delete CF Collection User by ID
const deleteCFCollectionUser = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedUser = await CollectionUser.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.status(200).json({ success: true, message: "CF Collection User deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

// Get CF Collection Users by name (partial match, case-insensitive)
const getCFCollectionUserByName = async (req, res) => {
    try {
        const { name } = req.params;

        if (!name) {
            return res.status(400).json({ success: false, message: "Name is required" });
        }

        const users = await CollectionUser.find({
            name: { $regex: name, $options: "i" }
        });

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "No users found with this name" });
        }

        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server Error", error: error.message });
    }
};

export default {
    createCFCollectionUser,
    getAllCFCollectionUsers,
    updateCFCollectionUser,
    deleteCFCollectionUser,
    getCFCollectionUserByName
};
