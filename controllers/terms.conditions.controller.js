import Terms from '../models/terms.conditions.model.js';

// CREATE
export const createTerms = async (req, res) => {
  try {
    const { companyId, title, description } = req.body;

    if (!companyId || !title || !description) {
      return res.status(400).json({ message: "Required fields are missing!" });
    }

    const terms = new Terms({ companyId, title, description });
    await terms.save();

    res.status(201).json({ message: "Terms & Conditions created successfully", data: terms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL
export const getAllTerms = async (req, res) => {
  try {
    const terms = await Terms.find();
    res.status(200).json({ data: terms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET BY COMPANY ID
export const getTermsByCompanyId = async (req, res) => {
  try {
    const { companyId } = req.params;

    const terms = await Terms.find({ companyId });

    if (!terms.length) {
      return res.status(404).json({ message: "No terms found for this company ID" });
    }

    res.status(200).json({ data: terms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE BY ID
export const updateTerms = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description } = req.body;

    const updated = await Terms.findByIdAndUpdate(
      id,
      { title, description },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Terms not found" });
    }

    res.status(200).json({ message: "Terms updated successfully", data: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE BY ID
export const deleteTerms = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await Terms.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({ message: "Terms not found" });
    }

    res.status(200).json({ message: "Terms deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
