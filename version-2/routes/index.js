import express from 'express'

import bookingRouter from '../../version-2/routes/booking.routes.js'

const app=express.Router()


app.use("/booking",bookingRouter)



export default app