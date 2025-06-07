import CFExtraCharge from '../models/cf.extra.charge.model.js';

const createCFExtraCharge = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized: companyId missing' });

    const {
      agentName,
      chargeName,
      fromCity,
      toCity,
      charge,
      modeOnPrice,
      itemName,
      dispatchType,
      isActive
    } = req.body;

    const newCharge = new CFExtraCharge({
      companyId,  // add companyId here
      agentName,
      chargeName,
      fromCity,
      toCity,
      charge,
      modeOnPrice,
      itemName,
      dispatchType,
      isActive
    });

    const savedCharge = await newCharge.save();
    res.status(201).json({ success: true, data: savedCharge });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Get all extra charges for the company
const getAllCFExtraCharges = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const charges = await CFExtraCharge.find({ companyId });
    res.status(200).json({ success: true, data: charges });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Get extra charge(s) by agentName for the company
const getCFExtraChargeByAgentName = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const { agentName } = req.params;

    const charges = await CFExtraCharge.find({ companyId, agentName });

    if (!charges || charges.length === 0) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.status(200).json({ success: true, data: charges });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Update an extra charge by ID for the company
const updateCFExtraCharge = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const updatedCharge = await CFExtraCharge.findOneAndUpdate(
      { _id: req.params.id, companyId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedCharge) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.status(200).json({ success: true, data: updatedCharge });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

// Delete an extra charge by ID for the company
const deleteCFExtraCharge = async (req, res) => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const deleted = await CFExtraCharge.findOneAndDelete({ _id: req.params.id, companyId });

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Charge not found' });
    }
    res.status(200).json({ success: true, message: 'Charge deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export default {
  createCFExtraCharge,
  getAllCFExtraCharges,
  getCFExtraChargeByAgentName,
  updateCFExtraCharge,
  deleteCFExtraCharge,
};
