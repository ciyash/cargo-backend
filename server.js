import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import router from "./routes/index.js";
import cors from "cors";
// import cron from "node-cron";
import branchReportController from "./controllers/branch.report.controller.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

const app = express();

app.use(express.json({ limit: "40mb" }));
app.use(express.urlencoded({extended:true}))

app.use(cors());
app.use("/", router);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("mongodb connected successfully"))
  .catch((error) => console.log("mongodb disconnected", error));

app.listen(PORT, () => console.log(`server running on port ${PORT}`));

// --- Cron job setup here ---
// cron.schedule("0 0 * * *", async () => {
//   console.log("🕛 Running daily branch snapshot job at midnight");
//   try {
//     await branchReportController.createDailyBranchSnapshot();
//     console.log("✅ Daily snapshot created successfully");
//   } catch (error) {
//     console.error("❌ Error running cron job:", error.message);
//   }
// });
