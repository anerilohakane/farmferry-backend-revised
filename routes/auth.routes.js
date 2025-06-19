import { Router } from "express";
import {
  registerCustomer,
  registerSupplier,
  registerAdmin,
  loginCustomer,
  loginSupplier,
  loginAdmin,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  changePassword,
  sendPhoneVerification,
  verifyPhone,
  loginDeliveryAssociate,
  getDeliveryAssociateMe
} from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Registration routes
router.post("/register/customer", registerCustomer);
router.post("/register/supplier", registerSupplier);
router.post("/register/admin", registerAdmin);

// Login routes
router.post("/login/customer", loginCustomer);
router.post("/login/supplier", loginSupplier);
router.post("/login/admin", loginAdmin);
router.post("/login/delivery-associate", loginDeliveryAssociate);

// Logout route
router.post("/logout", verifyJWT, logout);

// Token refresh route
router.post("/refresh-token", refreshAccessToken);

// Password management routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);
router.post("/change-password", verifyJWT, changePassword);

// Phone verification routes
router.post("/send-phone-verification", sendPhoneVerification);
router.post("/verify-phone", verifyPhone);

router.get("/me/delivery-associate", verifyJWT, getDeliveryAssociateMe);

export default router;
