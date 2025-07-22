import { Router } from "express";
import {
  getAdminProfile,
  updateAdminProfile,
  getAllCustomers,
  getCustomerById,
  getAllSuppliers,
  getSupplierById,
  updateSupplierStatus,
  verifySupplierDocument,
  getAllDeliveryAssociates,
  getDashboardStats,
  getRevenueAnalytics,
  getProductAnalytics,
  getCustomerAnalytics,
  changeAdminPassword
} from "../controllers/admin.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply JWT verification and admin role to all routes
router.use(verifyJWT, authorizeRoles("admin"));

// Profile routes
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);
router.put("/change-password", changeAdminPassword);

// Customer management
router.get("/customers", getAllCustomers);
router.get("/customers/:id", getCustomerById);

// Supplier management
router.get("/suppliers", getAllSuppliers);
router.get("/suppliers/:id", getSupplierById);
router.put("/suppliers/:id/status", updateSupplierStatus);
router.put("/suppliers/:supplierId/documents/:documentId/verify", verifySupplierDocument);

// Delivery associate management
router.get("/delivery-associates", getAllDeliveryAssociates);

// Analytics and dashboard
router.get("/dashboard-stats", getDashboardStats);
router.get("/analytics/revenue", getRevenueAnalytics);
router.get("/analytics/products", getProductAnalytics);
router.get("/analytics/customers", getCustomerAnalytics);

export default router;
