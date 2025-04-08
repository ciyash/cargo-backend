import CFMaster from '../models/cf.master.model.js';

// Create a new master record
const createMasterBooking = async (req, res) => {
  try {
    const {
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
      postPaidRole,
      PAN,
      accountNo,
      ifscCode,
      tanNo,
      creditDaysLimit,
      exDate,
      partyAccountEmail,
      transportEmail,
      executiveName,
    } = req.body;

    const newMaster = new CFMaster({
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
      postPaidRole,
      PAN,
      accountNo,
      ifscCode,
      tanNo,
      creditDaysLimit,
      exDate,
      partyAccountEmail,
      transportEmail,
      executiveName,
    });

    await newMaster.save();

    res.status(201).json({ message: 'Master record created successfully', data: newMaster });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get all master records
const getAllMasters = async (req, res) => {
  try {
    const masters = await CFMaster.find();
    res.status(200).json({ success: true, data: masters });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get master records by name (or similar text search)
const getMasterByName = async (req, res) => {
  try {
    const { name } = req.params;

    const masters = await CFMaster.find({ name: { $regex: name, $options: 'i' } });

    if (masters.length === 0) {
      return res.status(404).json({ success: false, message: 'No master records found for this name' });
    }

    res.status(200).json({ success: true, data: masters });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

// Update a master record by ID
const updateMaster = async (req, res) => {
  try {
    const updatedMaster = await CFMaster.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedMaster) {
      return res.status(404).json({ success: false, message: 'Master record not found' });
    }

    res.status(200).json({ success: true, message: 'Master record updated successfully', data: updatedMaster });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Delete a master record by ID
const deleteMaster = async (req, res) => {
  try {
    const deletedMaster = await CFMaster.findByIdAndDelete(req.params.id);

    if (!deletedMaster) {
      return res.status(404).json({ success: false, message: 'Master record not found' });
    }

    res.status(200).json({ success: true, message: 'Master record deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCFMasterByCity=async(req,res) => {
  try{
    const {city}=req.params
    const master=await CFMaster.find({city})
    if(master.length===0){
      return res.status(404).json({message:"city not found in data !"})
    }
    res.status(200).json(master)
  }
  catch(error){
   res.status(500).json({error:error.message})
  }
}

export default {
  createMasterBooking,
  getAllMasters,
  getMasterByName,
  updateMaster,
  deleteMaster,
  getCFMasterByCity
};
