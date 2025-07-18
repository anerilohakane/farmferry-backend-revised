import { Router } from "express";
import {
  registerCustomer,
  loginCustomer,
  logout,
  refreshAccessToken,
  changePassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchHistory,
  registerAdmin,
  registerSupplier,
  login,
  forgotPassword,
  resetPassword,
  sendPhoneVerification,
  verifyPhoneOTP,
  sendDeliveryAssociatePhoneVerification,
  loginDeliveryAssociate,
  getDeliveryAssociateMe,
  loginSupplier,
  loginAdmin
} from "../controllers/auth.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// ================== PUBLIC ROUTES (No JWT required) ==================
router.post("/register", registerCustomer);
router.post("/login", login);
router.post("/login/customer", loginCustomer);
router.post("/login/supplier", loginSupplier);
router.post("/login/admin", loginAdmin); // <-- Add this line
router.post("/login/delivery-associate", loginDeliveryAssociate); // <-- Moved to public section
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// OTP routes
router.post("/send-phone-verification", sendPhoneVerification);
router.post("/verify-phone-otp", verifyPhoneOTP);
router.post("/send-delivery-associate-otp", sendDeliveryAssociatePhoneVerification);

// ================== SECURED ROUTES (JWT required) ==================
router.use(verifyJWT); // Apply JWT middleware to all routes below

router.post("/logout", logout);
router.post("/change-password", changePassword);
router.get("/current-user", getCurrentUser);
router.patch("/update-account", updateAccountDetails);
router.patch("/update-avatar", upload.single("avatar"), updateUserAvatar);
router.patch("/update-cover-image", upload.single("coverImage"), updateUserCoverImage);

// Supplier/Admin registration (if these should be protected)
router.post("/register/supplier", registerSupplier);
router.post("/register/admin", registerAdmin);

// Channel routes
router.get("/c/:username", getUserChannelProfile);
router.get("/history", getWatchHistory);

// Delivery associate protected route
router.get("/me/delivery-associate", getDeliveryAssociateMe);

export default router;