import Bank from '../models/bank.model.js'; 


const createBank = async (req, res) => {
  try {
    const { accountType, accountName, accountCode, currency, accountNumber, bankName, ifsc, description, primary } = req.body;

    // Validate required fields
    if (!accountType || !accountName || !accountCode || !currency || !accountNumber || !bankName) {
      return res.status(400).json({ message: 'All required fields must be provided.' });
    }

   const existingBank = await Bank.findOne({ accountNumber });
    if (existingBank) {
      return res.status(409).json({ message: 'Bank with this account number already exists.' });
    }

    const newBank = new Bank({
      accountType,
      accountName,
      accountCode,
      currency,
      accountNumber,
      bankName,
      ifsc,
      description,
      primary,
    });

    // Save the new bank record to the database
    await newBank.save();

    // Send success response
    res.status(201).json({ message: 'Bank record created successfully', bank: newBank });
  } catch (error) {
    console.error('Error creating bank:', error);
    res.status(500).json({ message: 'Error creating bank record', error: error.message });
  }
};

// Get all bank records
const getAllBanks = async (req, res) => {
  try {
    const banks = await Bank.find(); // Retrieve all banks from the database
    res.status(200).json(banks);
  } catch (error) {
    console.error('Error retrieving banks:', error);
    res.status(500).json({ message: 'Error retrieving bank records', error: error.message });
  }
};

// Get a bank record by ID
const getBankById = async (req, res) => {
  try {
    const bank = await Bank.findById(req.params.id); // Find bank by ID
    if (!bank) {
      return res.status(404).json({ message: 'Bank record not found.' });
    }
    res.status(200).json(bank);
  } catch (error) {
    console.error('Error retrieving bank by ID:', error);
    res.status(500).json({ message: 'Error retrieving bank record', error: error.message });
  }
};

// Update a bank record by ID
const updateBank = async (req, res) => {
  try {
    const { accountType, accountName, accountCode, currency, accountNumber, bankName, ifsc, description, primary } = req.body;

    // Find and update the bank record by ID
    const updatedBank = await Bank.findByIdAndUpdate(
      req.params.id,
      {
        accountType,
        accountName,
        accountCode,
        currency,
        accountNumber,
        bankName,
        ifsc,
        description,
        primary,
      },
      { new: true } // Return the updated document
    );

    if (!updatedBank) {
      return res.status(404).json({ message: 'Bank record not found.' });
    }

    res.status(200).json({ message: 'Bank record updated successfully', bank: updatedBank });
  } catch (error) {
    console.error('Error updating bank:', error);
    res.status(500).json({ message: 'Error updating bank record', error: error.message });
  }
};

// Delete a bank record by ID
const deleteBank = async (req, res) => {
  try {
    const deletedBank = await Bank.findByIdAndDelete(req.params.id); // Find and delete the bank record by ID
    if (!deletedBank) {
      return res.status(404).json({ message: 'Bank record not found.' });
    }

    res.status(200).json({ message: 'Bank record deleted successfully', bank: deletedBank });
  } catch (error) {
    console.error('Error deleting bank:', error);
    res.status(500).json({ message: 'Error deleting bank record', error: error.message });
  }
};

export default {
  createBank,
  getAllBanks,
  getBankById,
  updateBank,
  deleteBank,
};
