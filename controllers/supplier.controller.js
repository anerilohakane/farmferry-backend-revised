import Supplier from "../models/supplier.model.js";
import Product from "../models/product.model.js";
import Order from "../models/order.model.js";
import Admin from "../models/admin.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary.js";

// Get supplier profile
export const getSupplierProfile = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier },
      "Supplier profile fetched successfully"
    )
  );
});

// Update supplier profile
export const updateSupplierProfile = asyncHandler(async (req, res) => {
  const { 
    businessName, 
    ownerName, 
    phone, 
    businessType,
    description,
    gstNumber
  } = req.body;
  
  const updateFields = {};
  
  if (businessName) updateFields.businessName = businessName;
  if (ownerName) updateFields.ownerName = ownerName;
  if (phone) updateFields.phone = phone;
  if (businessType) updateFields.businessType = businessType;
  if (description) updateFields.description = description;
  if (gstNumber) updateFields.gstNumber = gstNumber;
  
  // Handle logo upload if file is provided
  if (req.files?.logo) {
    const supplier = await Supplier.findById(req.user._id);
    
    // Delete old logo if exists
    if (supplier.logo?.publicId) {
      await deleteFromCloudinary(supplier.logo.publicId);
    }
    
    // Upload new logo
    const uploadResult = await uploadToCloudinary(req.files.logo[0].path, "suppliers/logos");
    
    if (!uploadResult) {
      throw new ApiError(500, "Error uploading logo");
    }
    
    updateFields.logo = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id
    };
  }
  
  const updatedSupplier = await Supplier.findByIdAndUpdate(
    req.user._id,
    { $set: updateFields },
    { new: true }
  ).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!updatedSupplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: updatedSupplier },
      "Supplier profile updated successfully"
    )
  );
});

// Update logo
export const updateLogo = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Logo image is required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Delete old logo if exists
  if (supplier.logo?.publicId) {
    await deleteFromCloudinary(supplier.logo.publicId);
  }
  
  // Upload new logo
  const uploadResult = await uploadToCloudinary(req.file.path, "suppliers/logos");
  
  if (!uploadResult) {
    throw new ApiError(500, "Error uploading logo");
  }
  
  // Update supplier logo
  supplier.logo = {
    url: uploadResult.url,
    publicId: uploadResult.public_id
  };
  
  await supplier.save();
  
  const updatedSupplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: updatedSupplier },
      "Logo updated successfully"
    )
  );
});

// Update address
export const updateAddress = asyncHandler(async (req, res) => {
  const { 
    street, 
    city, 
    state, 
    postalCode, 
    country, 
    landmark,
    coordinates 
  } = req.body;
  
  if (!street || !city || !state || !postalCode || !country) {
    throw new ApiError(400, "All address fields are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Update address
  supplier.address = {
    street,
    city,
    state,
    postalCode,
    country,
    landmark: landmark || "",
    coordinates: coordinates || {}
  };
  
  await supplier.save();
  
  const updatedSupplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { supplier: updatedSupplier },
      "Address updated successfully"
    )
  );
});

// Update bank details
export const updateBankDetails = asyncHandler(async (req, res) => {
  const { accountName, accountNumber, bankName, ifscCode, branchName } = req.body;
  
  // Validate required fields
  if (!accountName || !accountNumber || !bankName || !ifscCode) {
    throw new ApiError(400, "Account name, number, bank name, and IFSC code are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Update bank details
  supplier.bankDetails = {
    accountName,
    accountNumber,
    bankName,
    ifscCode,
    branchName: branchName || ""
  };
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { bankDetails: supplier.bankDetails },
      "Bank details updated successfully"
    )
  );
});

// Upload verification document
export const uploadVerificationDocument = asyncHandler(async (req, res) => {
  const { documentType } = req.body;
  
  if (!documentType || !req.file) {
    throw new ApiError(400, "Document type and file are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Upload document
  const uploadResult = await uploadToCloudinary(req.file.path, "suppliers/documents");
  
  if (!uploadResult) {
    throw new ApiError(500, "Error uploading document");
  }
  
  // Check if document of this type already exists
  const existingDocIndex = supplier.documents.findIndex(doc => doc.type === documentType);
  
  if (existingDocIndex !== -1) {
    // Delete old document from cloudinary
    await deleteFromCloudinary(supplier.documents[existingDocIndex].publicId);
    
    // Update existing document
    supplier.documents[existingDocIndex] = {
      type: documentType,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      uploadedAt: new Date(),
      isVerified: false
    };
  } else {
    // Add new document
    supplier.documents.push({
      type: documentType,
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      uploadedAt: new Date(),
      isVerified: false
    });
  }
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { documents: supplier.documents },
      "Document uploaded successfully"
    )
  );
});

// Get supplier products
export const getSupplierProducts = asyncHandler(async (req, res) => {
  const { 
    search, 
    category, 
    isActive, 
    sort = "createdAt", 
    order = "desc", 
    page = 1, 
    limit = 10 
  } = req.query;
  
  const queryOptions = { supplierId: req.user._id };
  
  // Search by name
  if (search) {
    queryOptions.name = { $regex: search, $options: "i" };
  }
  
  // Filter by category
  if (category) {
    queryOptions.categoryId = category;
  }
  
  // Filter by active status
  if (isActive !== undefined) {
    queryOptions.isActive = isActive === "true";
  }
  
  // Calculate pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  
  // Prepare sort options
  const sortOptions = {};
  sortOptions[sort] = order === "asc" ? 1 : -1;
  
  // Get products with pagination
  const products = await Product.find(queryOptions)
    .populate("categoryId", "name")
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));
  
  // Get total count
  const totalProducts = await Product.countDocuments(queryOptions);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        products,
        pagination: {
          total: totalProducts,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalProducts / parseInt(limit))
        }
      },
      "Supplier products fetched successfully"
    )
  );
});

// Get supplier orders
export const getSupplierOrders = asyncHandler(async (req, res) => {
  const { 
    status, 
    customerId, 
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
  
  // Filter by customer
  if (customerId) {
    queryOptions.customer = customerId;
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
    .populate("customer", "firstName lastName email")
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
      "Supplier orders fetched successfully"
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
  
  // Find the items belonging to this supplier
  const supplierItemIndex = order.items.findIndex(item => 
    item.supplier.toString() === req.user._id.toString()
  );
  
  if (supplierItemIndex === -1) {
    throw new ApiError(403, "You don't have permission to update this order");
  }
  
  // Update the status of the supplier's items
  order.items[supplierItemIndex].status = status;
  
  if (note) {
    order.items[supplierItemIndex].notes = [
      ...order.items[supplierItemIndex].notes || [],
      {
        content: note,
        createdBy: req.user._id,
        createdAt: new Date()
      }
    ];
  }
  
  await order.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { order },
      "Order status updated successfully"
    )
  );
});

// Get supplier dashboard stats
export const getSupplierDashboardStats = asyncHandler(async (req, res) => {
  const supplierId = req.user._id;
  
  // Get total products
  const totalProducts = await Product.countDocuments({ supplierId });
  
  // Get active products
  const activeProducts = await Product.countDocuments({ 
    supplierId, 
    isActive: true 
  });
  
  // Get total orders
  const totalOrders = await Order.countDocuments({ supplier: supplierId });
  
  // Get orders by status
  const pendingOrders = await Order.countDocuments({ 
    supplier: supplierId, 
    status: "pending" 
  });
  
  const processingOrders = await Order.countDocuments({ 
    supplier: supplierId, 
    status: "processing" 
  });
  
  const deliveredOrders = await Order.countDocuments({ 
    supplier: supplierId, 
    status: "delivered" 
  });
  
  // Get recent orders
  const recentOrders = await Order.find({ supplier: supplierId })
    .populate("customer", "firstName lastName")
    .populate("items.product", "name")
    .sort({ createdAt: -1 })
    .limit(5);
  
  // Get revenue stats
  const today = new Date();
  const startOfToday = new Date(today.setHours(0, 0, 0, 0));
  const endOfToday = new Date(today.setHours(23, 59, 59, 999));
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Today's revenue
  const todayRevenue = await Order.aggregate([
    { 
      $match: { 
        supplier: supplierId,
        status: { $in: ["delivered", "processing", "out_for_delivery"] },
        createdAt: { $gte: startOfToday, $lte: endOfToday }
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: "$totalAmount" } 
      } 
    }
  ]);
  
  // Monthly revenue
  const monthlyRevenue = await Order.aggregate([
    { 
      $match: { 
        supplier: supplierId,
        status: { $in: ["delivered", "processing", "out_for_delivery"] },
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: "$totalAmount" } 
      } 
    }
  ]);
  
  // Total revenue
  const totalRevenue = await Order.aggregate([
    { 
      $match: { 
        supplier: supplierId,
        status: { $in: ["delivered", "processing", "out_for_delivery"] }
      } 
    },
    { 
      $group: { 
        _id: null, 
        total: { $sum: "$totalAmount" } 
      } 
    }
  ]);
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        products: {
          total: totalProducts,
          active: activeProducts
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          processing: processingOrders,
          delivered: deliveredOrders
        },
        revenue: {
          today: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
          monthly: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0,
          total: totalRevenue.length > 0 ? totalRevenue[0].total : 0
        },
        recentOrders
      },
      "Supplier dashboard stats fetched successfully"
    )
  );
});

// Get supplier profile
// export const getSupplierProfile = asyncHandler(async (req, res) => {
//   const supplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
//   if (!supplier) {
//     throw new ApiError(404, "Supplier not found");
//   }
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { supplier },
//       "Supplier profile fetched successfully"
//     )
//   );
// });

// Update supplier profile
// export const updateSupplierProfile = asyncHandler(async (req, res) => {
//   const { 
//     businessName, 
//     ownerName, 
//     phone, 
//     businessType,
//     description,
//     gstNumber
//   } = req.body;
  
//   const updateFields = {};
  
//   if (businessName) updateFields.businessName = businessName;
//   if (ownerName) updateFields.ownerName = ownerName;
//   if (phone) updateFields.phone = phone;
//   if (businessType) updateFields.businessType = businessType;
//   if (description) updateFields.description = description;
//   if (gstNumber) updateFields.gstNumber = gstNumber;
  
//   // Handle logo upload if file is provided
//   if (req.files?.logo) {
//     const supplier = await Supplier.findById(req.user._id);
    
//     // Delete old logo if exists
//     if (supplier.logo?.publicId) {
//       await deleteFromCloudinary(supplier.logo.publicId);
//     }
    
//     // Upload new logo
//     const uploadResult = await uploadToCloudinary(req.files.logo[0].path, "suppliers/logos");
    
//     if (!uploadResult) {
//       throw new ApiError(500, "Error uploading logo");
//     }
    
//     updateFields.logo = {
//       url: uploadResult.secure_url,
//       publicId: uploadResult.public_id
//     };
//   }
  
//   const updatedSupplier = await Supplier.findByIdAndUpdate(
//     req.user._id,
//     { $set: updateFields },
//     { new: true }
//   ).select("-password -passwordResetToken -passwordResetExpires");
  
//   if (!updatedSupplier) {
//     throw new ApiError(404, "Supplier not found");
//   }
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { supplier: updatedSupplier },
//       "Supplier profile updated successfully"
//     )
//   );
// });

// Update logo
// export const updateLogo = asyncHandler(async (req, res) => {
//   if (!req.file) {
//     throw new ApiError(400, "Logo image is required");
//   }
  
//   const supplier = await Supplier.findById(req.user._id);
  
//   if (!supplier) {
//     throw new ApiError(404, "Supplier not found");
//   }
  
//   // Delete old logo if exists
//   if (supplier.logo?.publicId) {
//     await deleteFromCloudinary(supplier.logo.publicId);
//   }
  
//   // Upload new logo
//   const uploadResult = await uploadToCloudinary(req.file.path, "suppliers/logos");
  
//   if (!uploadResult) {
//     throw new ApiError(500, "Error uploading logo");
//   }
  
//   // Update supplier logo
//   supplier.logo = {
//     url: uploadResult.url,
//     publicId: uploadResult.public_id
//   };
  
//   await supplier.save();
  
//   const updatedSupplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { supplier: updatedSupplier },
//       "Logo updated successfully"
//     )
//   );
// });

// Update address
// export const updateAddress = asyncHandler(async (req, res) => {
//   const { 
//     street, 
//     city, 
//     state, 
//     postalCode, 
//     country, 
//     landmark,
//     coordinates 
//   } = req.body;
  
//   if (!street || !city || !state || !postalCode || !country) {
//     throw new ApiError(400, "All address fields are required");
//   }
  
//   const supplier = await Supplier.findById(req.user._id);
  
//   if (!supplier) {
//     throw new ApiError(404, "Supplier not found");
//   }
  
//   // Update address
//   supplier.address = {
//     street,
//     city,
//     state,
//     postalCode,
//     country,
//     landmark: landmark || "",
//     coordinates: coordinates || {}
//   };
  
//   await supplier.save();
  
//   const updatedSupplier = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { supplier: updatedSupplier },
//       "Address updated successfully"
//     )
//   );
// });



// Update supplier address
export const updateSupplierAddress = asyncHandler(async (req, res) => {
  const { street, city, state, postalCode, country } = req.body;
  
  // Validate required fields
  if (!street || !city || !state || !postalCode || !country) {
    throw new ApiError(400, "All address fields are required");
  }
  
  const supplier = await Supplier.findById(req.user._id);
  
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Update address
  supplier.address = {
    street,
    city,
    state,
    postalCode,
    country
  };
  
  await supplier.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { address: supplier.address },
      "Supplier address updated successfully"
    )
  );
});

// Update bank details
// export const updateBankDetails = asyncHandler(async (req, res) => {
//   const { accountName, accountNumber, bankName, ifscCode, branchName } = req.body;
  
//   // Validate required fields
//   if (!accountName || !accountNumber || !bankName || !ifscCode) {
//     throw new ApiError(400, "Account name, number, bank name, and IFSC code are required");
//   }
  
//   const supplier = await Supplier.findById(req.user._id);
  
//   if (!supplier) {
//     throw new ApiError(404, "Supplier not found");
//   }
  
//   // Update bank details
//   supplier.bankDetails = {
//     accountName,
//     accountNumber,
//     bankName,
//     ifscCode,
//     branchName: branchName || ""
//   };
  
//   await supplier.save();
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { bankDetails: supplier.bankDetails },
//       "Bank details updated successfully"
//     )
//   );
// });

// Upload verification document
// export const uploadVerificationDocument = asyncHandler(async (req, res) => {
//   const { documentType } = req.body;
  
//   if (!documentType || !req.file) {
//     throw new ApiError(400, "Document type and file are required");
//   }
  
//   const supplier = await Supplier.findById(req.user._id);
  
//   if (!supplier) {
//     throw new ApiError(404, "Supplier not found");
//   }
  
//   // Upload document
//   const uploadResult = await uploadToCloudinary(req.file.path, "suppliers/documents");
  
//   if (!uploadResult) {
//     throw new ApiError(500, "Error uploading document");
//   }
  
//   // Check if document of this type already exists
//   const existingDocIndex = supplier.documents.findIndex(doc => doc.type === documentType);
  
//   if (existingDocIndex !== -1) {
//     // Delete old document from cloudinary
//     await deleteFromCloudinary(supplier.documents[existingDocIndex].publicId);
    
//     // Update existing document
//     supplier.documents[existingDocIndex] = {
//       type: documentType,
//       url: uploadResult.secure_url,
//       publicId: uploadResult.public_id,
//       uploadedAt: new Date(),
//       isVerified: false
//     };
//   } else {
//     // Add new document
//     supplier.documents.push({
//       type: documentType,
//       url: uploadResult.secure_url,
//       publicId: uploadResult.public_id,
//       uploadedAt: new Date(),
//       isVerified: false
//     });
//   }
  
//   await supplier.save();
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { documents: supplier.documents },
//       "Document uploaded successfully"
//     )
//   );
// });

// Get supplier products
// export const getSupplierProducts = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10, category, search } = req.query;
  
//   const options = {
//     page: parseInt(page),
//     limit: parseInt(limit),
//     sort: { createdAt: -1 }
//   };
  
//   const query = { supplier: req.user._id };
  
//   // Add category filter if provided
//   if (category) {
//     query.category = category;
//   }
  
//   // Add search filter if provided
//   if (search) {
//     query.$or = [
//       { name: { $regex: search, $options: 'i' } },
//       { description: { $regex: search, $options: 'i' } }
//     ];
//   }
  
//   const products = await Product.find(query)
//     .skip((options.page - 1) * options.limit)
//     .limit(options.limit)
//     .sort(options.sort);
  
//   const totalProducts = await Product.countDocuments(query);
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { 
//         products,
//         totalProducts,
//         currentPage: options.page,
//         totalPages: Math.ceil(totalProducts / options.limit),
//         hasMore: options.page < Math.ceil(totalProducts / options.limit)
//       },
//       "Products fetched successfully"
//     )
//   );
// });

// Get supplier orders
// export const getSupplierOrders = asyncHandler(async (req, res) => {
//   const { page = 1, limit = 10, status } = req.query;
  
//   const options = {
//     page: parseInt(page),
//     limit: parseInt(limit),
//     sort: { createdAt: -1 }
//   };
  
//   const query = { 'items.supplier': req.user._id };
  
//   // Add status filter if provided
//   if (status) {
//     query['items.status'] = status;
//   }
  
//   const orders = await Order.find(query)
//     .skip((options.page - 1) * options.limit)
//     .limit(options.limit)
//     .sort(options.sort)
//     .populate('customer', 'firstName lastName email phone')
//     .populate('items.product', 'name price images');
  
//   // Filter items in each order to only include those belonging to this supplier
//   const filteredOrders = orders.map(order => {
//     const supplierItems = order.items.filter(item => 
//       item.supplier.toString() === req.user._id.toString()
//     );
    
//     return {
//       _id: order._id,
//       orderNumber: order.orderNumber,
//       customer: order.customer,
//       items: supplierItems,
//       totalAmount: supplierItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
//       createdAt: order.createdAt,
//       updatedAt: order.updatedAt
//     };
//   });
  
//   const totalOrders = await Order.countDocuments(query);
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { 
//         orders: filteredOrders,
//         totalOrders,
//         currentPage: options.page,
//         totalPages: Math.ceil(totalOrders / options.limit),
//         hasMore: options.page < Math.ceil(totalOrders / options.limit)
//       },
//       "Orders fetched successfully"
//     )
//   );
// });

// Update order status
// export const updateOrderStatus = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { status, note } = req.body;
  
//   if (!status) {
//     throw new ApiError(400, "Status is required");
//   }
  
//   const order = await Order.findById(id);
  
//   if (!order) {
//     throw new ApiError(404, "Order not found");
//   }
  
//   // Find the items belonging to this supplier
//   const supplierItemIndex = order.items.findIndex(item => 
//     item.supplier.toString() === req.user._id.toString()
//   );
  
//   if (supplierItemIndex === -1) {
//     throw new ApiError(403, "You don't have permission to update this order");
//   }
  
//   // Update the status of the supplier's items
//   order.items[supplierItemIndex].status = status;
  
//   if (note) {
//     order.items[supplierItemIndex].notes = [
//       ...order.items[supplierItemIndex].notes || [],
//       {
//         content: note,
//         createdBy: req.user._id,
//         createdAt: new Date()
//       }
//     ];
//   }
  
//   await order.save();
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { order },
//       "Order status updated successfully"
//     )
//   );
// });

// Get supplier dashboard stats
// export const getSupplierDashboardStats = asyncHandler(async (req, res) => {
//   // Get total products
//   const totalProducts = await Product.countDocuments({ supplier: req.user._id });
  
//   // Get total orders
//   const totalOrders = await Order.countDocuments({ 'items.supplier': req.user._id });
  
//   // Get pending orders
//   const pendingOrders = await Order.countDocuments({ 
//     'items.supplier': req.user._id,
//     'items.status': 'pending'
//   });
  
//   // Get revenue stats
//   const orders = await Order.find({ 
//     'items.supplier': req.user._id,
//     'items.status': 'delivered'
//   });
  
//   let totalRevenue = 0;
  
//   orders.forEach(order => {
//     const supplierItems = order.items.filter(item => 
//       item.supplier.toString() === req.user._id.toString() && item.status === 'delivered'
//     );
    
//     totalRevenue += supplierItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
//   });
  
//   // Get recent orders
//   const recentOrders = await Order.find({ 'items.supplier': req.user._id })
//     .sort({ createdAt: -1 })
//     .limit(5)
//     .populate('customer', 'firstName lastName')
//     .populate('items.product', 'name price images');
  
//   // Filter items in each order to only include those belonging to this supplier
//   const filteredRecentOrders = recentOrders.map(order => {
//     const supplierItems = order.items.filter(item => 
//       item.supplier.toString() === req.user._id.toString()
//     );
    
//     return {
//       _id: order._id,
//       orderNumber: order.orderNumber,
//       customer: order.customer,
//       items: supplierItems,
//       totalAmount: supplierItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
//       status: supplierItems[0]?.status || 'pending',
//       createdAt: order.createdAt
//     };
//   });
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { 
//         stats: {
//           totalProducts,
//           totalOrders,
//           pendingOrders,
//           totalRevenue
//         },
//         recentOrders: filteredRecentOrders
//       },
//       "Dashboard stats fetched successfully"
//     )
//   );
// });

// Update order status
// export const updateOrderStatus = asyncHandler(async (req, res) => {
//   const { id } = req.params;
//   const { status, note } = req.body;
  
//   if (!status) {
//     throw new ApiError(400, "Status is required");
//   }
  
//   const order = await Order.findById(id);
  
//   if (!order) {
//     throw new ApiError(404, "Order not found");
//   }
  
//   // Find the items belonging to this supplier
//   const supplierItemIndex = order.items.findIndex(item => 
//     item.supplier.toString() === req.user._id.toString()
//   );
  
//   if (supplierItemIndex === -1) {
//     throw new ApiError(403, "You don't have permission to update this order");
//   }
  
//   // Update the status of the supplier's items
//   order.items[supplierItemIndex].status = status;
  
//   if (note) {
//     order.items[supplierItemIndex].notes = [
//       ...order.items[supplierItemIndex].notes || [],
//       {
//         content: note,
//         createdBy: req.user._id,
//         createdAt: new Date()
//       }
//     ];
//   }
  
//   await order.save();
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { order },
//       "Order status updated successfully"
//     )
//   );
// });

// Get supplier dashboard stats
// export const getSupplierDashboardStats = asyncHandler(async (req, res) => {
//   const supplierId = req.user._id;
  
//   // Get total products
//   const totalProducts = await Product.countDocuments({ supplierId });
  
//   // Get active products
//   const activeProducts = await Product.countDocuments({ 
//     supplierId, 
//     isActive: true 
//   });
  
//   // Get total orders
//   const totalOrders = await Order.countDocuments({ supplier: supplierId });
  
//   // Get orders by status
//   const pendingOrders = await Order.countDocuments({ 
//     supplier: supplierId, 
//     status: "pending" 
//   });
  
//   const processingOrders = await Order.countDocuments({ 
//     supplier: supplierId, 
//     status: "processing" 
//   });
  
//   const deliveredOrders = await Order.countDocuments({ 
//     supplier: supplierId, 
//     status: "delivered" 
//   });
  
//   // Get recent orders
//   const recentOrders = await Order.find({ supplier: supplierId })
//     .populate("customer", "firstName lastName")
//     .populate("items.product", "name")
//     .sort({ createdAt: -1 })
//     .limit(5);
  
//   // Get revenue stats
//   const today = new Date();
//   const startOfToday = new Date(today.setHours(0, 0, 0, 0));
//   const endOfToday = new Date(today.setHours(23, 59, 59, 999));
  
//   const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
//   const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  
//   // Today's revenue
//   const todayRevenue = await Order.aggregate([
//     { 
//       $match: { 
//         supplier: supplierId,
//         status: { $in: ["delivered", "processing", "out_for_delivery"] },
//         createdAt: { $gte: startOfToday, $lte: endOfToday }
//       } 
//     },
//     { 
//       $group: { 
//         _id: null, 
//         total: { $sum: "$totalAmount" } 
//       } 
//     }
//   ]);
  
//   // Monthly revenue
//   const monthlyRevenue = await Order.aggregate([
//     { 
//       $match: { 
//         supplier: supplierId,
//         status: { $in: ["delivered", "processing", "out_for_delivery"] },
//         createdAt: { $gte: startOfMonth, $lte: endOfMonth }
//       } 
//     },
//     { 
//       $group: { 
//         _id: null, 
//         total: { $sum: "$totalAmount" } 
//       } 
//     }
//   ]);
  
//   // Total revenue
//   const totalRevenue = await Order.aggregate([
//     { 
//       $match: { 
//         supplier: supplierId,
//         status: { $in: ["delivered", "processing", "out_for_delivery"] }
//       } 
//     },
//     { 
//       $group: { 
//         _id: null, 
//         total: { $sum: "$totalAmount" } 
//       } 
//     }
//   ]);
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { 
//         products: {
//           total: totalProducts,
//           active: activeProducts
//         },
//         orders: {
//           total: totalOrders,
//           pending: pendingOrders,
//           processing: processingOrders,
//           delivered: deliveredOrders
//         },
//         revenue: {
//           today: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
//           monthly: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0,
//           total: totalRevenue.length > 0 ? totalRevenue[0].total : 0
//         },
//         recentOrders
//       },
//       "Supplier dashboard stats fetched successfully"
//     )
//   );
// });
