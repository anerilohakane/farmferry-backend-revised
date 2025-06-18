import { Router } from "express";
import {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  assignDeliveryAssociate,
  updateDeliveryStatus,
  getMyOrders
} from "../controllers/order.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply JWT verification to all routes
router.use(verifyJWT);

// Customer routes
router.post("/", authorizeRoles("customer"), createOrder);

// Common routes (accessible by all authenticated users with appropriate roles)
router.get("/:id", getOrderById);

// Admin routes
router.get("/", authorizeRoles("admin"), getAllOrders);

// Supplier routes
router.get("/supplier/me", authorizeRoles("supplier"), getMyOrders);

// Supplier and admin routes
router.put(
  "/:id/status",
  authorizeRoles("supplier", "admin", "customer", "deliveryAssociate"),
  updateOrderStatus
);

router.put(
  "/:id/assign-delivery",
  authorizeRoles("supplier", "admin"),
  assignDeliveryAssociate
);

// Delivery associate routes
router.put(
  "/:id/delivery-status",
  authorizeRoles("deliveryAssociate"),
  updateDeliveryStatus
);

export default router;
