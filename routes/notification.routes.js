import { Router } from 'express';
import { getNotifications } from '../controllers/notification.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyJWT);
router.get('/', getNotifications);

export default router; 