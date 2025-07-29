import express from 'express';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { authorizeRoles } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/multer.middleware.js';
import {
  loginSuperAdmin,
  getSuperAdminProfile,
  updateSuperAdminProfile,
  changeSuperAdminPassword,
  uploadSuperAdminAvatar
} from '../controllers/superadmin.controller.js';

const router = express.Router();

// Public routes
router.post('/login', loginSuperAdmin);

// Protected routes - require authentication
router.use(verifyJWT);
router.use(authorizeRoles('superadmin'));

router.get('/profile', getSuperAdminProfile);
router.put('/profile', updateSuperAdminProfile);
router.put('/change-password', changeSuperAdminPassword);
router.put('/avatar', upload.single('avatar'), uploadSuperAdminAvatar);

export default router; 