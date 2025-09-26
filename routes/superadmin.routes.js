import express from 'express';
import cors from 'cors';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import {
  loginSuperAdmin,
  getSuperAdminProfile,
  updateSuperAdminProfile,
  changeSuperAdminPassword,
  uploadSuperAdminAvatar,
  logoutSuperAdmin
} from '../controllers/superadmin.controller.js';

const router = express.Router();

// Enable CORS for all origins
router.use(cors({ origin: '*' }));

// Public routes
router.post('/superadmin/login', loginSuperAdmin);
router.post('/logout', logoutSuperAdmin);

// Protected routes - require authentication
router.use(verifyJWT);
router.use(authorizeRoles('superadmin'));

router.get('/profile', getSuperAdminProfile);
router.put('/profile', updateSuperAdminProfile);
router.put('/change-password', changeSuperAdminPassword);
router.put('/avatar', upload.single('avatar'), uploadSuperAdminAvatar);

export default router;