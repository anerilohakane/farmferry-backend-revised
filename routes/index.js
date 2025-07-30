import { Router } from "express";
import authRoutes from "./auth.routes.js";
import customerRoutes from "./customer.routes.js";
import supplierRoutes from "./supplier.routes.js";
import productRoutes from "./product.routes.js";
import categoryRoutes from "./category.routes.js";
import orderRoutes from "./order.routes.js";
import cartRoutes from "./cart.routes.js";
import reviewRoutes from "./review.routes.js";
import adminRoutes from "./admin.routes.js";
import deliveryAssociateRoutes from "./deliveryAssociate.routes.js";
import notificationRoutes from "./notification.routes.js";
import advancedDeliveryRoutes from "./advancedDelivery.routes.js";
import superadminRoutes from "./superadmin.routes.js";

import smsRoutes from "./sms.routes.js";

const router = Router();

// Register all routes
router.use("/auth", authRoutes);
router.use("/customers", customerRoutes);
router.use("/suppliers", supplierRoutes);
router.use("/products", productRoutes);
router.use("/categories", categoryRoutes);
router.use("/orders", orderRoutes);
router.use("/cart", cartRoutes);
router.use("/reviews", reviewRoutes);
router.use("/admin", adminRoutes);
router.use("/delivery-associates", deliveryAssociateRoutes);
router.use("/notifications", notificationRoutes);
router.use("/advanced-delivery", advancedDeliveryRoutes);
router.use("/superadmin", superadminRoutes);


router.use("/sms", smsRoutes); 


export default router;
