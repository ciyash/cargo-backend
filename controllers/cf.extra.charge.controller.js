import CFExtraCharge from '../models/cf.extra.charge.model.js'

const createCFExtraCharge = async (req, res) => {
    try {
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
      res.status(201).json(savedCharge);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };

// Get all extra charges
 const getAllCFExtraCharges = async (req, res) => {
  try {
    const charges = await CFExtraCharge.find()
    res.status(200).json(charges);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a single extra charge by ID
 const getCFExtraChargeByAgentName = async (req, res) => {
  try {
    const {agentName}=req.params
    const charge = await CFExtraCharge.find({agentName})
    if (!charge) {
      return res.status(404).json({ message: 'Charge not found' });
    }
    res.status(200).json(charge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an extra charge by ID
 const updateCFExtraCharge = async (req, res) => {
  try {
    const updatedCharge = await CFExtraCharge.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedCharge) {
      return res.status(404).json({ message: 'Charge not found' });
    }
    res.status(200).json(updatedCharge);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete an extra charge by ID
 const deleteCFExtraCharge = async (req, res) => {
  try {
    const deleted = await CFExtraCharge.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ message: 'Charge not found' });
    }
    res.status(200).json({ message: 'Charge deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default {
 createCFExtraCharge,
 getAllCFExtraCharges,
 getCFExtraChargeByAgentName,
 updateCFExtraCharge,
 deleteCFExtraCharge,

}