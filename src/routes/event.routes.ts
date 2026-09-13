import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { requireRole } from '../middlewares/role.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Public / Authenticated discovery
router.get('/', EventController.listEvents);
router.get('/:id', EventController.getEventById);

// Protected Organizer / Admin endpoints
router.post(
  '/',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.createEvent
);

router.put(
  '/:id',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.updateEvent
);

router.delete(
  '/:id',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.deleteEvent
);

router.get(
  '/:id/attendees',
  authMiddleware,
  requireRole(Role.ORGANIZER, Role.ADMIN),
  EventController.getAttendees
);

export default router;
