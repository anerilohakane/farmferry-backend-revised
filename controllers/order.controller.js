import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendSMS from "../utils/sms.js";
import sendEmail from "../utils/email.js";
import Supplier from "../models/supplier.model.js";
import Admin from "../models/admin.model.js";
import Customer from "../models/customer.model.js";
import { generateInvoicePDF, shouldGenerateInvoice, getInvoiceUrl } from "../utils/invoiceGenerator.js";
import fs from 'fs';
import path from 'path';

// Create a new order
export const createOrder = asyncHandler(async (req, res) => {
  const { 
    items, 
    deliveryAddress, 
    paymentMethod, 
    couponCode,
    isExpressDelivery,
    notes
  } = req.body;
  
  console.log('Order creation request body:', req.body);
  console.log('Items received:', items);
  
  // Validate required fields
  if (!items || !items.length || !deliveryAddress || !paymentMethod) {
    throw new ApiError(400, "Items, delivery address, and payment method are required");
  }
  
  // Group items by supplier
  const itemsBySupplier = {};
  
  // Validate items and calculate totals
  for (const item of items) {
    console.log('Processing item:', item);
    if (!item.product || !item.quantity) {
      console.log('Invalid item - product:', item.product, 'quantity:', item.quantity);
      throw new ApiError(400, "Product ID and quantity are required for each item");
    }
    
    // Get product details
    const product = await Product.findById(item.product);
    if (!product) {
      throw new ApiError(404, `Product not found: ${item.product}`);
    }
    
    // Check stock
    if (product.stockQuantity < item.quantity) {
      throw new ApiError(400, `Insufficient stock for ${product.name}`);
    }
    
    // Get variation if specified
    let variationPrice = 0;
    if (item.variation) {
      const variation = product.variations.find(v => 
        v.name === item.variation.name && v.value === item.variation.value
      );
      
      if (variation) {
        variationPrice = variation.additionalPrice || 0;
        
        // Check variation stock
        if (variation.stockQuantity < item.quantity) {
          throw new ApiError(400, `Insufficient stock for ${product.name} (${variation.name}: ${variation.value})`);
        }
      }
    }
    
    // Calculate price
    const price = product.price + variationPrice;
    const discountedPrice = product.discountedPrice 
      ? product.discountedPrice + variationPrice 
      : price;
    
    // Group by supplier
    const supplierId = product.supplierId.toString();
    if (!itemsBySupplier[supplierId]) {
      itemsBySupplier[supplierId] = [];
    }
    
    // Add item to supplier group
    itemsBySupplier[supplierId].push({
      product: product._id,
      quantity: item.quantity,
      price,
      discountedPrice,
      variation: item.variation,
      totalPrice: item.quantity * discountedPrice
    });
  }
  
  // Create orders for each supplier
  const orders = [];
  
  for (const supplierId in itemsBySupplier) {
    const supplierItems = itemsBySupplier[supplierId];
    
    // Calculate subtotal
    const subtotal = supplierItems.reduce((sum, item) => sum + item.totalPrice, 0);
    
    // Calculate delivery charge
    const deliveryCharge = isExpressDelivery ? 50 : 20; // Example values
    
    // Calculate taxes (example: 5% of subtotal)
    const taxes = Math.round(subtotal * 0.05);
    
    // Calculate discount amount (if coupon applied)
    let discountAmount = 0;
    if (couponCode) {
      // In a real application, validate coupon code and calculate discount
      // For now, use a placeholder value
      discountAmount = Math.round(subtotal * 0.1); // 10% discount
    }
    
    // Calculate total amount
    const totalAmount = subtotal - discountAmount + taxes + deliveryCharge;
    
    // Create order
    const order = await Order.create({
      customer: req.user._id,
      supplier: supplierId,
      items: supplierItems,
      subtotal,
      couponCode,
      discountAmount,
      taxes,
      deliveryCharge,
      totalAmount,
      paymentMethod,
      status: "pending",
      isExpressDelivery: isExpressDelivery || false,
      deliveryAddress,
      notes,
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
    });
    
    // Add status history entry
    order.statusHistory.push({
      status: "pending",
      updatedAt: new Date(),
      updatedBy: req.user._id,
      updatedByModel: "Customer"
    });
    
    await order.save();
    
    // Update product stock
    for (const item of supplierItems) {
      const product = await Product.findById(item.product);
      
      // Update main stock
      product.stockQuantity -= item.quantity;
      
      // Update variation stock if applicable
      if (item.variation) {
        const variationIndex = product.variations.findIndex(v => 
          v.name === item.variation.name && v.value === item.variation.value
        );
        
        if (variationIndex !== -1) {
          product.variations[variationIndex].stockQuantity -= item.quantity;
        }
      }
      
      await product.save();
    }
    
    orders.push(order);

    // --- Notification Logic ---
    // Fetch customer and supplier details
    const customer = await Customer.findById(req.user._id);
    const supplier = await Supplier.findById(supplierId);

    // Send SMS to customer
    // if (customer && customer.phone) {
    //   // Format phone number to E.164 (prepend +91 if not present)
    //   let to = customer.phone;
    //   if (!to.startsWith('+')) {
    //     to = '+91' + to;
    //   }
    //   await sendSMS(
    //     to,
    //     `Your order ${order._id} has been placed successfully!`
    //   );
    // }

    // Send Email to customer
    if (customer && customer.email) {
      await sendEmail({
        to: customer.email,
        subject: "Order Confirmation",
        html: `<p>Your order <b>${order._id}</b> has been placed successfully!</p>`
      });
    }

    // Send Email to supplier
    if (supplier && supplier.email) {
      await sendEmail({
        to: supplier.email,
        subject: "New Order Received",
        html: `<p>You have received a new order <b>${order._id}</b>.</p>`
      });
    }
    // --- End Notification Logic ---
  }
  
  // Clear customer's cart if order was created from cart
  if (req.body.clearCart) {
    const cart = await Cart.findOne({ customer: req.user._id });
    if (cart) {
      cart.items = [];
      cart.subtotal = 0;
      await cart.save();
    }
  }
  
  return res.status(201).json(
    new ApiResponse(
      201,
      { orders },
      "Orders created successfully"
    )
  );
});

// Get all orders (admin only)
export const getAllOrders = asyncHandler(async (req, res) => {
  const { 
    status, 
    customerId, 
    supplierId, 
    startDate, 
    endDate, 
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = {};
  
  // Filter by status
  if (status) {
    queryOptions.status = status;
  }
  
  // Filter by customer
  if (customerId) {
    queryOptions.customer = customerId;
  }
  
  // Filter by supplier
  if (supplierId) {
    queryOptions.supplier = supplierId;
  }
  
  // Filter by date range
  if (startDate && endDate) {
    queryOptions.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  } else if (startDate) {
    queryOptions.createdAt = { $gte: new Date(startDate) };
  } else if (endDate) {
    queryOptions.createdAt = { $lte: new Date(endDate) };
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName")
    .populate("items.product", "name images")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Orders fetched successfully"
    )
  );
});

// Get order by ID
export const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id)
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName email phone")
    .populate("items.product", "name images")
    .populate("deliveryAssociate.associate", "name phone");
  
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer._id.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  const isDeliveryAssociate = req.user.role === "deliveryAssociate" && 
    order.deliveryAssociate?.associate?.toString() === req.user._id.toString();
  
  if (!isCustomer && !isSupplier && !isAdmin && !isDeliveryAssociate) {
    throw new ApiError(403, "You are not authorized to view this order");
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Order fetched successfully"
    )
  );
});

// Update order status
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  
  if (!status) {
    throw new ApiError(400, "Status is required");
  }
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  const isDeliveryAssociate = req.user.role === "deliveryAssociate" && 
    order.deliveryAssociate?.associate?.toString() === req.user._id.toString();
  
  if (!isCustomer && !isSupplier && !isAdmin && !isDeliveryAssociate) {
    throw new ApiError(403, "You are not authorized to update this order");
  }
  
  // Validate status transition based on role
  const validTransitions = {
    customer: {
      pending: ["cancelled"],
      delivered: ["returned"]
    },
    supplier: {
      pending: ["pending", "cancelled"],
      processing: ["processing", "cancelled"],
      out_for_delivery: ["cancelled", "damaged"]
    },
    admin: {
      pending: ["processing", "cancelled"],
      processing: ["out_for_delivery", "cancelled"],
      out_for_delivery: ["delivered", "cancelled", "damaged"],
      delivered: ["returned"],
      cancelled: ["pending"],
      returned: ["processing"],
      damaged: []
    },
    deliveryAssociate: {
      out_for_delivery: ["out_for_delivery"]
    }
  };

  // Debug logging for transition check
  console.log('--- Order Status Transition Debug ---');
  console.log('Current order.status:', order.status);
  console.log('Requested status:', status);
  console.log('User role:', req.user.role);
  console.log('Allowed transitions for this status:', validTransitions[req.user.role][order.status]);
  console.log('-------------------------------------');
  
  const roleTransitions = validTransitions[req.user.role];
  if (!roleTransitions || !roleTransitions[order.status] || !roleTransitions[order.status].includes(status)) {
    throw new ApiError(400, `Cannot transition from ${order.status} to ${status} as ${req.user.role}`);
  }
  
  // Update order status
  order.status = status;
  
  // Add status history entry
  order.statusHistory.push({
    status,
    updatedAt: new Date(),
    updatedBy: req.user._id,
    updatedByModel: req.user.role === "customer" ? "Customer" : 
                    req.user.role === "supplier" ? "Supplier" : 
                    req.user.role === "admin" ? "Admin" : "DeliveryAssociate",
    note: note || ""
  });
  
  // Update delivered date if status is delivered
  if (status === "delivered") {
    order.deliveredAt = new Date();
  }

  // Notify when marked as damaged
  if (status === "damaged") {
    console.log(`Order ${order._id} marked as DAMAGED by ${req.user.role} (${req.user._id}) at ${new Date().toISOString()}`);
  }
  
  await order.save();

  // Auto-generate invoice when order is delivered or payment is completed
  if (status === "delivered" || (order.paymentMethod !== "cash_on_delivery" && order.paymentStatus === "paid")) {
    await autoGenerateInvoice(order);
  }

  // Notify supplier and admin if order is returned
  if (status === "returned") {
    // Fetch supplier and admin
    const supplier = await Supplier.findById(order.supplier);
    const admin = await Admin.findOne({});
    const customer = await Customer.findById(order.customer);
    const reason = note || "No reason provided.";
    // Email content
    const subject = `Order #${order._id} Return Requested`;
    const html = `
      <h2>Order Return Requested</h2>
      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Customer:</strong> ${customer?.firstName || ""} ${customer?.lastName || ""} (${customer?.email || ""})</p>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    `;
    if (supplier?.email) {
      await sendEmail({
        to: supplier.email,
        subject,
        html
      });
    }
    if (admin?.email) {
      await sendEmail({
        to: admin.email,
        subject,
        html
      });
    }
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Order status updated successfully"
    )
  );
});

// Assign delivery associate to order
export const assignDeliveryAssociate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deliveryAssociateId } = req.body;
  
  if (!deliveryAssociateId) {
    throw new ApiError(400, "Delivery associate ID is required");
  }
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  // Check authorization (only admin or supplier can assign)
  const isSupplier = req.user.role === "supplier" && order.supplier.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  
  if (!isSupplier && !isAdmin) {
    throw new ApiError(403, "You are not authorized to assign delivery associate");
  }
  
  // Check if order status is valid for assignment
  if (order.status !== "processing") {
    throw new ApiError(400, "Delivery associate can only be assigned to orders in processing status");
  }
  
  // Update delivery associate
  order.deliveryAssociate = {
    associate: deliveryAssociateId,
    assignedAt: new Date(),
    status: "assigned"
  };
  
  await order.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Delivery associate assigned successfully"
    )
  );
});

// Update delivery status
export const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, note } = req.body;
  
  if (!status) {
    throw new ApiError(400, "Status is required");
  }
  
  const order = await Order.findById(id);
  
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  // Check authorization (only delivery associate assigned to this order can update)
  const isAssignedDeliveryAssociate = 
    req.user.role === "deliveryAssociate" && 
    order.deliveryAssociate?.associate?.toString() === req.user._id.toString();
  
  if (!isAssignedDeliveryAssociate) {
    throw new ApiError(403, "You are not authorized to update delivery status");
  }
  
  // Validate status transition
  const validTransitions = {
    assigned: ["picked_up"],
    picked_up: ["on_the_way"],
    on_the_way: ["delivered", "failed"],
    delivered: [],
    failed: []
  };
  
  if (!validTransitions[order.deliveryAssociate.status] || 
      !validTransitions[order.deliveryAssociate.status].includes(status)) {
    throw new ApiError(400, `Cannot transition from ${order.deliveryAssociate.status} to ${status}`);
  }
  
  // Update delivery status
  order.deliveryAssociate.status = status;
  
  // Update order status if delivery status is delivered
  if (status === "delivered") {
    order.status = "delivered";
    order.deliveredAt = new Date();
    
    // Add status history entry
    order.statusHistory.push({
      status: "delivered",
      updatedAt: new Date(),
      updatedBy: req.user._id,
      updatedByModel: "DeliveryAssociate",
      note: note || "Delivered by delivery associate"
    });
  }
  
  await order.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Delivery status updated successfully"
    )
  );
});

// Get my orders (supplier only)
export const getMyOrders = asyncHandler(async (req, res) => {
  const { 
    status, 
    startDate, 
    endDate, 
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = { supplier: req.user._id };
  
  // Filter by status
  if (status) {
    queryOptions.status = status;
  }
  
  // Filter by date range
  if (startDate || endDate) {
    queryOptions.createdAt = {};
    if (startDate) queryOptions.createdAt.$gte = new Date(startDate);
    if (endDate) queryOptions.createdAt.$lte = new Date(endDate);
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("customer", "firstName lastName email phone")
    .populate("items.product", "name images price discountedPrice")
    .populate("deliveryAssociate.associate", "firstName lastName phone")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Orders fetched successfully"
    )
  );
});

// Get order status counts (supplier only)
export const getOrderStatusCounts = asyncHandler(async (req, res) => {
  const supplierId = req.user._id;
  // Aggregate counts by status for this supplier
  const counts = await Order.aggregate([
    { $match: { supplier: supplierId } },
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);
  // Format counts
  const statusCounts = {
    all: 0,
    pending: 0,
    processing: 0,
    out_for_delivery: 0,
    delivered: 0,
  };
  counts.forEach(item => {
    if (statusCounts.hasOwnProperty(item._id)) {
      statusCounts[item._id] = item.count;
      statusCounts.all += item.count;
    }
  });
  return res.status(200).json(new ApiResponse(200, statusCounts, "Order status counts fetched successfully"));
});

// Get available orders for delivery associates (unassigned orders in processing state)
export const getAvailableOrdersForDelivery = asyncHandler(async (req, res) => {
  const orders = await Order.find({
    status: { $in: ["pending", "processing"] },
    $or: [
      { "deliveryAssociate.associate": { $exists: false } },
      { "deliveryAssociate.associate": null }
    ]
  })
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName")
    .populate("items.product", "name images");

  return res.status(200).json(
    new ApiResponse(200, { orders }, "Available orders fetched successfully")
  );
});

// Allow delivery associate to self-assign an order
export const selfAssignOrder = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, "Order not found");
  if (order.deliveryAssociate?.associate)
    throw new ApiError(400, "Order already assigned");
  if (!["pending", "processing"].includes(order.status))
    throw new ApiError(400, "Order not available for assignment");

  order.deliveryAssociate = {
    associate: req.user._id,
    assignedAt: new Date(),
    status: "assigned"
  };
  await order.save();
  return res.status(200).json(
    new ApiResponse(200, { order }, "Order self-assigned successfully")
  );
});

// Get my orders (customer only)
export const getMyCustomerOrders = asyncHandler(async (req, res) => {
  const {
    status,
    startDate,
    endDate,
    sort = "createdAt",
    order = "desc",
    page = 1,
    limit = 10
  } = req.query;

  const queryOptions = { customer: req.user._id };

  // Filter by status
  if (status) {
    queryOptions.status = status;
  }

  // Filter by date range
  if (startDate || endDate) {
    queryOptions.createdAt = {};
    if (startDate) queryOptions.createdAt.$gte = new Date(startDate);
    if (endDate) queryOptions.createdAt.$lte = new Date(endDate);
  }

  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;

  // Get orders with pagination
  const orders = await Order.find(queryOptions)
    .populate("supplier", "businessName")
    .populate("items.product", "name images price discountedPrice")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  // Get total count
  const totalOrders = await Order.countDocuments(queryOptions);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        orders,
        pagination: {
          total: totalOrders,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalOrders / parseInt(limit))
        }
      },
      "Orders fetched successfully"
    )
  );
});


// In backend - orders controller
export const getAvailableOrdersNearby = asyncHandler(async (req, res) => {
  const { longitude, latitude, maxDistance = 10000 } = req.query;

  if (!longitude || !latitude) {
    throw new ApiError(400, "Longitude and latitude are required");
  }
  console.log("User location:", latitude, longitude);
  const orders = await Order.find({
    status: "pending",
    isAssigned: false,
    "deliveryAddress.location": {      
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseInt(maxDistance),
        }
      }    
  })
  .populate("customer", "firstName lastName")
  .select("_id createdAt customer deliveryAddress");

  console.log("Found orders:", orders.map(o => o.deliveryAddress.location));
  return res.status(200).json(
    new ApiResponse(200, { orders }, "Nearby available orders fetched")
  );
});


// Generate invoice for an order
export const generateOrderInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id)
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName email phone")
    .populate("items.product", "name images price discountedPrice");
  
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer._id.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  
  if (!isCustomer && !isSupplier && !isAdmin) {
    throw new ApiError(403, "You are not authorized to generate invoice for this order");
  }
  
  // Check if invoice should be generated
  if (!shouldGenerateInvoice(order)) {
    throw new ApiError(400, "Invoice can only be generated for delivered orders or paid online payments");
  }
  
  // Check if invoice already exists
  if (order.invoiceUrl) {
    return res.status(200).json(
      new ApiResponse(
        200,
        { 
          invoiceUrl: getInvoiceUrl(order),
          message: "Invoice already exists"
        },
        "Invoice URL retrieved successfully"
      )
    );
  }
  
  try {
    // Generate invoice
    const invoiceUrl = await generateInvoicePDF(order, order.customer, order.supplier);
    
    // Update order with invoice URL
    order.invoiceUrl = invoiceUrl;
    await order.save();
    
    return res.status(200).json(
      new ApiResponse(
        200,
        { invoiceUrl },
        "Invoice generated successfully"
      )
    );
  } catch (error) {
    console.error('Error generating invoice:', error);
    throw new ApiError(500, "Failed to generate invoice");
  }
});

// Get invoice file for an order
export const getOrderInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const order = await Order.findById(id)
    .populate("customer", "firstName lastName email phone")
    .populate("supplier", "businessName email phone");
  
  if (!order) {
    throw new ApiError(404, "Order not found");
  }
  
  // Check authorization
  const isCustomer = req.user.role === "customer" && order.customer._id.toString() === req.user._id.toString();
  const isSupplier = req.user.role === "supplier" && order.supplier._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === "admin";
  
  if (!isCustomer && !isSupplier && !isAdmin) {
    throw new ApiError(403, "You are not authorized to view invoice for this order");
  }
  
  if (!order.invoiceUrl) {
    throw new ApiError(404, "Invoice not found for this order");
  }
  
  try {
    // Get the file path from the URL
    const filePath = path.join(__dirname, '../public', order.invoiceUrl);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new ApiError(404, "Invoice file not found");
    }
    
    // Set headers for text file download
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderId}.txt"`);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving invoice file:', error);
    throw new ApiError(500, "Failed to serve invoice file");
  }
});

// Auto-generate invoice when order is delivered
export const autoGenerateInvoice = async (order) => {
  try {
    if (shouldGenerateInvoice(order)) {
      const populatedOrder = await Order.findById(order._id)
        .populate("customer", "firstName lastName email phone")
        .populate("supplier", "businessName email phone")
        .populate("items.product", "name images price discountedPrice");
      
      if (!populatedOrder.invoiceUrl) {
        const invoiceUrl = await generateInvoicePDF(populatedOrder, populatedOrder.customer, populatedOrder.supplier);
        populatedOrder.invoiceUrl = invoiceUrl;
        await populatedOrder.save();
        
        console.log(`Invoice generated for order ${order.orderId}: ${invoiceUrl}`);
      }
    }
  } catch (error) {
    console.error('Error auto-generating invoice:', error);
  }
};

export default {
  createOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  assignDeliveryAssociate,
  updateDeliveryStatus,
  getMyOrders,
  getOrderStatusCounts,
  getAvailableOrdersForDelivery,
  selfAssignOrder,
  getMyCustomerOrders,
  getAvailableOrdersNearby,
  generateOrderInvoice,
  getOrderInvoice
};
