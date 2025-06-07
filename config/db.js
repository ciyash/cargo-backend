
// // db/connection.js


// Connect to Shopglobal DB
const shopGlobalDb = mongoose.createConnection(shopGlobalUri);

// Connect to Sree Kaleswari DB
const sreeKaleswariDb = mongoose.createConnection(sreeKaleswariUri);

// Query users from specific DB connection
const Users = sreeKaleswariDb.model('Subadmin', adminSchema);

const users = await Users.find({});  // Only users in Sree Kaleswari DB









// import mongoose from "mongoose";
// import userSchema from "../models/shopglobal/User.js"; // from Shopglobal
// import companySchema from "../models/shopglobal/Company.js"; // from Shopglobal
// import leadSchema from "../models/crm/Lead.js"; // CRM schema

// const shopGlobalConnection = mongoose.createConnection(process.env.SHOPGLOBAL_DB_URL, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// const crmConnection = mongoose.createConnection(process.env.CRM_DB_URL, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// // export models
// export const ShopUser = shopGlobalConnection.model("User", userSchema);
// export const Company = shopGlobalConnection.model("Company", companySchema);

// export const Lead = crmConnection.model("Lead", leadSchema);
