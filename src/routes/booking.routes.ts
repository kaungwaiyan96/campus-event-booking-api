import { Router } from 'express';
import { BookingController } from '../controllers/booking.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

router.use(authMiddleware);

router.post('/', requireRole(Role.STUDENT, Role.ADMIN), BookingController.rsvp);
router.get('/my-bookings', requireRole(Role.STUDENT, Role.ADMIN), BookingController.getMyBookings);
router.delete('/:id', requireRole(Role.STUDENT, Role.ADMIN), BookingController.cancelBooking);

export default router;
