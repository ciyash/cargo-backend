import jwt from "jsonwebtoken";
import dotenv from 'dotenv';

dotenv.config();

const auth = (req, res, next) => {
  const authHeader = req.header("Authorization");
  console.log("Authorization Header:", authHeader); // Log received header

  if (!authHeader) {
    return res.status(401).json({ message: "Access Denied: No token provided" });
  }

  const token = authHeader.split(" ")[1]; 
  console.log("Extracted Token:", token); // Log extracted token

  if (!token) {
    return res.status(401).json({ message: "Access Denied: Invalid token format" });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Decoded Token:", verified); // Log decoded payload
    req.user = verified;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    res.status(401).json({ message: "Invalid Token" });
  }
};

export default auth;
