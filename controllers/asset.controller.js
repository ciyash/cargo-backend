import { Asset } from '../models/multi.model.js';

const createAsset = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized company access" });
    }

    const { name, value, assetType, purchaseDate } = req.body;

    if (!name || !value || !assetType || !purchaseDate) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const newAsset = new Asset({ name, value, assetType, purchaseDate, companyId });
    await newAsset.save();

    res.status(201).json({ message: "Asset added", asset: newAsset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getAssets = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized company access" });
    }

    // Filter assets by companyId
    const assets = await Asset.find({ companyId });
    res.status(200).json(assets);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getByAssetTypes = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized company access" });
    }

    const { assetType } = req.params;

    const assets = await Asset.find({ assetType, companyId });

    if (!assets.length) {
      return res.status(404).json({ message: "No assets found for this asset type" });
    }

    res.status(200).json(assets);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateAsset = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized company access" });
    }

    const { id } = req.params;

    // Ensure update only if asset belongs to this company
    const updatedAsset = await Asset.findOneAndUpdate(
      { _id: id, companyId },
      req.body,
      { new: true }
    );

    if (!updatedAsset)
      return res.status(404).json({ success: false, message: "Asset not found or unauthorized" });

    res.status(200).json({ success: true, message: "Asset updated", asset: updatedAsset });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteAsset = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(401).json({ message: "Unauthorized company access" });
    }

    const { id } = req.params;

    // Delete only if asset belongs to this company
    const deletedAsset = await Asset.findOneAndDelete({ _id: id, companyId });

    if (!deletedAsset)
      return res.status(404).json({ success: false, message: "Asset not found or unauthorized" });

    res.status(200).json({ success: true, message: "Asset deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default { createAsset, getAssets, getByAssetTypes, updateAsset, deleteAsset };
