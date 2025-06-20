import { Router } from "express";
import {
  getSupplierProfile,
  updateSupplierProfile,
  updateLogo,
  updateAddress,
  updateBankDetails,
  uploadVerificationDocument,
  getSupplierProducts,
  getSupplierOrders,
  updateOrderStatus,
  getSupplierDashboardStats,
  getSupplierOrderById
} from "../controllers/supplier.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Apply JWT verification to all routes
router.use(verifyJWT, authorizeRoles("supplier"));

// Profile routes
router.get("/profile", getSupplierProfile);
router.put("/profile", updateSupplierProfile);
router.put("/profile/logo", upload.single("logo"), updateLogo);
router.put("/address", updateAddress);
router.put("/bank-details", updateBankDetails);
router.post("/verification-document", upload.single("document"), uploadVerificationDocument);

// Product routes
router.get("/products", getSupplierProducts);

// Order routes
router.get("/orders", getSupplierOrders);
router.get("/orders/:id", getSupplierOrderById);
router.put("/orders/:id/status", updateOrderStatus);

// Dashboard stats
router.get("/dashboard-stats", getSupplierDashboardStats);

export default router;
