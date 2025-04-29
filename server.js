import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import router from "./routes/index.js";
import routers from "./version-2/routes/index.js"
import cors from "cors";

dotenv.config();  

const PORT = process.env.PORT || 4000;

const app = express();
    
app.use(express.json({ limit: "40mb" }));  

app.use(cors());                   
    
app.use("/", router);   
app.use("/v1", routers);   

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("mongodb connected successfully"))
  .catch((error) => console.log("mongodb disconnected", error));    
     
app.listen(PORT, () => console.log(`server running ${PORT}`));                      