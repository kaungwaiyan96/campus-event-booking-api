import { Router } from 'express';
import { apiKeyMiddleware } from '../middlewares/apiKey.middleware';
import { getActiveEvent } from '../controllers/peer.controller';

const router = Router();
router.get('/', apiKeyMiddleware, getActiveEvent);
export default router;
