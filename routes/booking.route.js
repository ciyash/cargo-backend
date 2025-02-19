import express from 'express'
import bookingCotroller from '../controllers/booking.cotroller.js'

const router=express.Router()

router.post("/",bookingCotroller.createBooking)

router.get("/",bookingCotroller.getAllBookings)

router.get("/grnNoUnique/:grnNoUnique",bookingCotroller.getBookingByGrnNo)

router.get("/adminUniqueId/:adminUniqueId",bookingCotroller.getBookingadminUniqueId)

router.get("/senderMobile/:senderMobile",bookingCotroller.getBookingBysenderMobile)

router.get("/receiverMobile/:receiverMobile",bookingCotroller.getBookingbyreceiverMobile)

router.get("/senderName/:senderName",bookingCotroller.getBookingsenderName)

router.get("/receiverName/:receiverName",bookingCotroller.getBookingsreceiverName)

router.get("/pickUpBranch/:pickUpBranch",bookingCotroller.getBookingPickUpBranch)

router.get("/lrNumber/:lrNumber",bookingCotroller.getBookinglrNumber)

router.delete("/:id",bookingCotroller.deleteBookings)

router.patch("/:id",bookingCotroller.updateBookings)

router.patch("/grnNoUnique/:grnNoUnique",bookingCotroller.updateGRNBookings)

export default router