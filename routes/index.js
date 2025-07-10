import express from 'express'
import companyRouter from '../routes/company.router.js'
import subAdminAuthRouter from './subadmin.auth.route.js'
import branchRouter from './branch.route.js'
import bookingRouter from './booking.route.js'
import vehicleRouter from './vehicle.route.js'
import parcelLoadingRouter from '../routes/parcel.loading.route.js'
import multiRouter from '../routes/multi.router.js'
import extraChargeRouter from '../routes/extra.charge.route.js'
import parcelUnloadingRouter from '../routes/parcel.unloading.route.js'
import expensiveRouter from '../routes/expensive.route.js'  
import bankRouter from '../routes/bank.route.js'
import itemRouter from '../routes/item.route.js'
import vendorRouter from '../routes/vendor.route.js' // Assuming you have a vendor route
import branchReportRouter from '../routes/branch.report.route.js' // Assuming you have a branch report route

//company routes  
import masterRouter from './cf.master.router.js'
import cfExtraChargeRouter from './cf.extra.charge.router.js'
import voucherRouter from './cf.voucher.generate.route.js'

// subadmin data  routes
import allRouter from './all.route.js'

const app=express.Router()



app.use("/company",companyRouter)
app.use("/subadmin-auth",subAdminAuthRouter)
app.use("/branch",branchRouter)
app.use("/booking",bookingRouter)
app.use("/vehicle",vehicleRouter) 
app.use("/parcel-loading",parcelLoadingRouter)
app.use("/multi-router",multiRouter)
app.use("/extra-charge",extraChargeRouter)
app.use("/parcel-unloading",parcelUnloadingRouter)     

app.use("/cfmaster",masterRouter)
app.use("/cfextra-charge",cfExtraChargeRouter)
app.use("/voucher-generate",voucherRouter)
app.use("/expensive",expensiveRouter)
app.use("/bank",bankRouter)
app.use("/item",itemRouter)
app.use("/vendor",vendorRouter) // Assuming you have a vendor route

app.use("/branch-report",branchReportRouter) // Assuming you have a branch report route    


export default app      