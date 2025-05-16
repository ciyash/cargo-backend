import Vendor from '../models/vendor.model.js';

// Create a new vendor
 const createVendor = async (req, res) => {
  try {
    const {
      name,
      companyName,
      displayName,
      address,
      workPhone,
      mobile,
      bankDetails = {},
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const vendor = new Vendor({
      name,
      companyName: companyName || '',
      displayName: displayName || '',
      address: address || '',
      workPhone: workPhone || '',
      mobile: mobile || '',
      bankDetails: {
        accountNumber: bankDetails.accountNumber || '',
        accountName: bankDetails.accountName || '',
        bankName: bankDetails.bankName || '',
        branchName: bankDetails.branchName || '',
        ifscCode: bankDetails.ifscCode || '',
      },
    });

    const savedVendor = await vendor.save();
    res.status(201).json({ message: 'Vendor created successfully', vendor: savedVendor });
  } catch (error) {
    res.status(500).json({ message: 'Error creating vendor', error: error.message });
  }
};

// Get all vendors
 const getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.status(200).json(vendors);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendors', error: error.message });
  }
};

// Get vendor by ID
 const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.status(200).json(vendor);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching vendor', error: error.message });
  }
};

// Update vendor
 const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const {
      name,
      companyName,
      displayName,
      address,
      workPhone,
      mobile,
      bankDetails = {},
    } = req.body;

    if (name !== undefined) vendor.name = name;
    if (companyName !== undefined) vendor.companyName = companyName;
    if (displayName !== undefined) vendor.displayName = displayName;
    if (address !== undefined) vendor.address = address;
    if (workPhone !== undefined) vendor.workPhone = workPhone;
    if (mobile !== undefined) vendor.mobile = mobile;

    if (bankDetails) {
      vendor.bankDetails.accountNumber = bankDetails.accountNumber || '';
      vendor.bankDetails.accountName = bankDetails.accountName || '';
      vendor.bankDetails.bankName = bankDetails.bankName || '';
      vendor.bankDetails.branchName = bankDetails.branchName || '';
      vendor.bankDetails.ifscCode = bankDetails.ifscCode || '';
    }

    const updatedVendor = await vendor.save();
    res.status(200).json({ message: 'Vendor updated successfully', vendor: updatedVendor });
  } catch (error) {
    res.status(500).json({ message: 'Error updating vendor', error: error.message });
  }
};

// Delete vendor
 const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.status(200).json({ message: 'Vendor deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting vendor', error: error.message });
  }
};

export default {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
};