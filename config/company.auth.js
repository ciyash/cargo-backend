// middleware/companyAuth.js
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const companyAuth = (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No or invalid token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.COMPANY_SECRET);

    if (!decoded.companyId) {
      return res.status(400).json({ message: "companyId is required in token" });
    }

    req.user = decoded; // ✅ sets req.user for use in controllers
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token", error: err.message });
  }
};

export default companyAuth;
