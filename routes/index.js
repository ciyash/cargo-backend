import express from 'express'
import adminAuthRouter from './admin.route.js'
import subAdminAuthRouter from './subadmin.auth.route.js'
import branchRouter from './branch.route.js'
import bookingRouter from './booking.route.js'
import vehicleRouter from './vehicle.route.js'
import parcelLoadingRouter from '../routes/parcel.loading.route.js'
import multiRouter from '../routes/multi.router.js'

const app=express.Router()

app.use("/admin-auth",adminAuthRouter)
app.use("/subadmin-auth",subAdminAuthRouter)
app.use("/branch",branchRouter)
app.use("/booking",bookingRouter)
app.use("/vehicle",vehicleRouter) 
app.use("/parcel-loading",parcelLoadingRouter)
app.use("/multi-router",multiRouter)


export default app