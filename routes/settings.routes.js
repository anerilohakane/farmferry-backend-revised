import { Router } from "express";
import {
  getSettings,
  updateSettings,
  getDeliveryCharges,
  resetSettings
} from "../controllers/settings.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";

const router = Router();

// Public routes
router.get("/", getSettings);
router.get("/delivery-charges", getDeliveryCharges);

// Admin only routes
router.put("/", verifyJWT, authorizeRoles("admin"), updateSettings);
router.post("/reset", verifyJWT, authorizeRoles("admin"), resetSettings);

export default router; 