import { Router } from "express";
import {
  getDeliveryAssociateProfile,
  updateDeliveryAssociateProfile,
  updateVehicleDetails,
  uploadDocument,
  updateOnlineStatus,
  getAssignedOrders,
  getOrderDetails,
  updateDeliveryStatus,
  getEarnings,
  getNearbyDeliveryAssociates,
  requestPayout
} from "../controllers/deliveryAssociate.controller.js";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Routes for finding nearby delivery associates (for admin/supplier)
router.get(
  "/nearby",
  verifyJWT,
  authorizeRoles("admin", "supplier"),
  getNearbyDeliveryAssociates
);

// Apply JWT verification and delivery associate role to all routes below
router.use(verifyJWT, authorizeRoles("deliveryAssociate"));

// Profile routes
router.get("/profile", getDeliveryAssociateProfile);
router.put(
  "/profile",
  upload.single("profileImage"),
  updateDeliveryAssociateProfile
);
router.put("/vehicle", updateVehicleDetails);
router.post(
  "/documents",
  upload.single("document"),
  uploadDocument
);
router.put("/status", updateOnlineStatus);

// Order routes
router.get("/orders", getAssignedOrders);
router.get("/orders/:id", getOrderDetails);
router.put("/orders/:id/status", updateDeliveryStatus);

// Earnings routes
router.get("/earnings", getEarnings);

// Payout route
router.post("/payout", requestPayout);

// Support routes
router.get("/support/faqs", (req, res) => res.json({ faqs: [
  { question: 'How do I start a new delivery?', answer: 'Go to Dashboard and tap Start New Delivery.' },
  { question: 'Where can I view my order history?', answer: 'Navigate to the Orders tab to see your order history.' },
  { question: 'How do I contact support?', answer: 'Use the Contact Support button in the Support screen.' }
]}));
router.post("/support/contact", (req, res) => res.json({ success: true, message: 'Support request submitted.' }));
router.post("/support/report", (req, res) => res.json({ success: true, message: 'Issue reported.' }));

// Feedback & proof upload
router.post("/orders/:id/feedback", (req, res) => res.json({ success: true, message: 'Feedback submitted.' }));
router.post("/orders/:id/proof", (req, res) => res.json({ success: true, message: 'Proof uploaded.' }));

export default router;
