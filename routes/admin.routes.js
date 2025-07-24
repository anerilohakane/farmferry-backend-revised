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
  changeAdminPassword,
  uploadAdminAvatar,
  createDeliveryAssociate,
  updateDeliveryAssociate,
  deleteDeliveryAssociate,
  updateSupplier,
  createSupplier
} from "../controllers/admin.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Apply JWT verification and admin role to all routes
router.use(verifyJWT, authorizeRoles("admin"));

// Profile routes
router.get("/profile", getAdminProfile);
router.put("/profile", updateAdminProfile);
router.put("/change-password", changeAdminPassword);

// Avatar upload
router.put("/avatar", upload.single("avatar"), uploadAdminAvatar);

// Customer management
router.get("/customers", getAllCustomers);
router.get("/customers/:id", getCustomerById);

// Supplier management
router.get("/suppliers", getAllSuppliers);
router.get("/suppliers/:id", getSupplierById);
router.put("/suppliers/:id/status", updateSupplierStatus);
router.put("/suppliers/:supplierId/documents/:documentId/verify", verifySupplierDocument);
router.put("/suppliers/:id", updateSupplier);
router.post("/suppliers", createSupplier);

// Delivery associate management
router.get("/delivery-associates", getAllDeliveryAssociates);
// Add CRUD routes for delivery associates
router.post("/delivery-associates", createDeliveryAssociate);
router.put("/delivery-associates/:id", updateDeliveryAssociate);
router.delete("/delivery-associates/:id", deleteDeliveryAssociate);

// Analytics and dashboard
router.get("/dashboard-stats", getDashboardStats);
router.get("/analytics/revenue", getRevenueAnalytics);
router.get("/analytics/products", getProductAnalytics);
router.get("/analytics/customers", getCustomerAnalytics);

export default router;
