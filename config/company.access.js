// middleware/checkReportAccess.js
import Company from "../models/company.model.js";


const checkCompanyAccess = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;

    console.log(req.user,'jdhkjfdkj')

    if (!companyId) { 
      return res.status(401).json({ message: "Company ID missing in token" });
    } 

    const company = await Company.findById(companyId).select("isBlocked companyAccess");

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    if (company.isBlocked) {
      return res.status(403).json({ message: "Company is blocked" });
    }

    if (!company.companyAccess) {
      return res.status(403).json({ message: "CRM access denied for this company." });
    }

    next(); // ✅ Allow
  } catch (error) {
    console.error("Access check error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};


export default checkCompanyAccess;
