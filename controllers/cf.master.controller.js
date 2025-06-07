import CFMaster from '../models/cf.master.model.js';

// Create a new master record
const createMaster = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      return res.status(401).json({ success: false, message: "Unauthorized: companyId missing" });
    }

    const {
      gst,
      country,
      state,
      city,
      code,
      name,
      email,
      phone,
      address,
      isActive,
      isPostPaid,
      isAgent,
      isAllowNegativeBooking,
      PAN,
      accountNo,
      ifscCode,
      tanNo,
      creditDaysLimit,
      exDate,
      partyAccountEmail,
      transportEmail,
      executiveName,
      senderName,
      senderMobile,
      receiverName,
      receiverMobile
    } = req.body;

    const newMaster = new CFMaster({
      companyId,  // add companyId here
      gst,
      country,
      state,
      city,
      code,
      name,
      email,
      phone,
      address,
      isActive,
      isPostPaid,
      isAgent,
      isAllowNegativeBooking,
      PAN,
      accountNo,
      ifscCode,
      tanNo,
      creditDaysLimit,
      exDate,
      partyAccountEmail,
      transportEmail,
      executiveName,
      senderName,
      senderMobile,
      receiverName,
      receiverMobile
    });

    await newMaster.save();

    res.status(201).json({ message: 'Master record created successfully', data: newMaster });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get all master records for the company
const getAllMasters = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const masters = await CFMaster.find({ companyId });
    res.status(200).json({ success: true, data: masters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get master records by name for the company (or similar text search)
const getMasterByName = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { name } = req.params;

    const masters = await CFMaster.find({ companyId, name: { $regex: name, $options: 'i' } });

    if (masters.length === 0) {
      return res.status(404).json({ success: false, message: 'No master records found for this name' });
    }

    res.status(200).json({ success: true, data: masters });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Update a master record by ID for the company
const updateMaster = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const updatedMaster = await CFMaster.findOneAndUpdate(
      { _id: req.params.id, companyId },
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedMaster) {
      return res.status(404).json({ success: false, message: 'Master record not found' });
    }

    res.status(200).json({ success: true, message: 'Master record updated successfully', data: updatedMaster });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a master record by ID for the company
const deleteMaster = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const deletedMaster = await CFMaster.findOneAndDelete({ _id: req.params.id, companyId });

    if (!deletedMaster) {
      return res.status(404).json({ success: false, message: 'Master record not found' });
    }

    res.status(200).json({ success: true, message: 'Master record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get master records by city for the company
const getCFMasterByCity = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const { city } = req.params;

    const masters = await CFMaster.find({ companyId, city });

    if (masters.length === 0) {
      return res.status(404).json({ message: "City not found in data!" });
    }

    res.status(200).json(masters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default {
  createMaster,
  getAllMasters,
  getMasterByName,
  updateMaster,
  deleteMaster,
  getCFMasterByCity
};
