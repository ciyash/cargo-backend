import express from 'express'
import subAdminAuthRouter from './subadmin.auth.route.js'
import branchRouter from './branch.route.js'
import bookingRouter from './booking.route.js'
import vehicleRouter from './vehicle.route.js'
import parcelLoadingRouter from '../routes/parcel.loading.route.js'
import multiRouter from '../routes/multi.router.js'
import extraChargeRouter from '../routes/extra.charge.route.js'
import parcelUnloadingRouter from '../routes/parcel.unloading.route.js'
import masterRouter from './master.router.js'

const app=express.Router()


app.use("/subadmin-auth",subAdminAuthRouter)
app.use("/branch",branchRouter)
app.use("/booking",bookingRouter)
app.use("/vehicle",vehicleRouter) 
app.use("/parcel-loading",parcelLoadingRouter)
app.use("/multi-router",multiRouter)
app.use("/extra-charge",extraChargeRouter)
app.use("/parcel-unloading",parcelUnloadingRouter)

app.use("/master",masterRouter)

export default app