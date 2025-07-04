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
  getDeliveryAssociateMe
} from "../controllers/auth.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.post("/register", registerCustomer); // Assuming customer registration
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

// OTP routes
router.post("/send-phone-verification", sendPhoneVerification);
router.post("/verify-phone-otp", verifyPhoneOTP);
router.post("/send-delivery-associate-otp", sendDeliveryAssociatePhoneVerification);


// Secured routes (require authentication)
router.post("/login/delivery-associate", loginDeliveryAssociate);
router.use(verifyJWT);

router.post("/logout", logout);
router.post("/change-password", changePassword);
router.get("/current-user", getCurrentUser);
router.patch("/update-account", updateAccountDetails);
router.patch(
  "/update-avatar",
  upload.single("avatar"),
  updateUserAvatar
);
router.patch(
  "/update-cover-image",
  upload.single("coverImage"),
  updateUserCoverImage
);

// Supplier/Admin specific routes might go here if needed
router.post("/register/supplier", registerSupplier);
router.post("/register/admin", registerAdmin);

// Channel routes
router.get("/c/:username", getUserChannelProfile);
router.get("/history", getWatchHistory);

router.get("/me/delivery-associate", getDeliveryAssociateMe);

export default router;
