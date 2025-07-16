
import Item from '../models/item.model.js';


// Create Item
const createItem = async (req, res) => {
  try {
    const {
      type,
      name,
      unit,
      salesInfo,
      purchaseInfo
    } = req.body;

    // Basic validation
    if (
      !type ||
      !name ||
      !salesInfo?.sellingPrice ||
      !salesInfo?.account ||
      !purchaseInfo?.costPrice ||
      !purchaseInfo?.account
    ) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newItem = new Item({
      type,
      name,
      unit,
      salesInfo,
      purchaseInfo
    });

    await newItem.save();

    res.status(201).json({ message: 'Item created successfully', item: newItem });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Failed to create item', error: error.message });
  }
};

// Get All Items
const getItems = async (req, res) => {
  try {
    const items = await Item.find();
    res.status(200).json({ message: 'Items fetched successfully', items });
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Failed to fetch items', error: error.message });
  }
};

// Get Item by ID
const getItemById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.status(200).json({ message: 'Item fetched successfully', item });
  } catch (error) {
    console.error('Error fetching item by ID:', error);
    res.status(500).json({ message: 'Failed to fetch item', error: error.message });
  }
};

// Update Item
const updateItem = async (req, res) => {
  try {
    const { type, name, unit, salesInfo, purchaseInfo } = req.body;

    const updatedItem = await Item.findByIdAndUpdate(
      req.params.id,
      { type, name, unit, salesInfo, purchaseInfo },
      { new: true }
    );

    if (!updatedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ message: 'Item updated successfully', item: updatedItem });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ message: 'Failed to update item', error: error.message });
  }
};

// Delete Item
const deleteItem = async (req, res) => {
  try {
    const deletedItem = await Item.findByIdAndDelete(req.params.id);

    if (!deletedItem) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ message: 'Failed to delete item', error: error.message });
  }
};


export default {
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem
};
