import ExcelJS from 'exceljs';
import Product from '../models/product.model.js';
import PreviewProduct from '../models/previewProduct.model.js';
import Category from '../models/category.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateProductTemplate, parseExcelFile } from '../utils/excelUtils.js';
// import { processProductImages } from '../utils/imageUtils.js';
import mongoose from 'mongoose';
import { validateProductData} from '../utils/uploadValidation.js';
import { processProductsInBatches}  from '../services/product.service.js';
import { processProductImages, getCategoryImage } from '../utils/imageUtils.js';
// import Category from '../models/category.model.js';
// import validateExcelStructure}
// Generate Excel template
export const generateTemplate = asyncHandler(async (req, res) => {
  const { supplierId, type } = req.params;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to access this supplier's template");
  }
  
  // Validate type parameter
  if (!['new', 'old'].includes(type)) {
    throw new ApiError(400, "Type must be 'new' or 'old'");
  }
  
  try {
    // Generate template using utility function
    const workbook = await generateProductTemplate(type, supplierId);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-products-template-${supplierId}.xlsx`);
    
    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    // Use ApiError to ensure proper formatting for your error handler
    throw new ApiError(500, `Failed to generate template: ${error.message}`);
  }
});

// Parse uploaded Excel file
// Parse uploaded Excel file (continued from previous)
export  const parseExcelUpload = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to upload products for this supplier");
  }
  
  if (!req.file) {
    throw new ApiError(400, "Excel file is required");
  }
  
  // Validate file type
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    throw new ApiError(400, "Only Excel files (.xlsx) are allowed");
  }
  
  try {
    // Parse Excel file using utility function
    const products = await parseExcelFile(req.file.buffer);
    
    // Validate Excel structure
    const structureErrors = validateProductData(products);
    if (structureErrors.length > 0) {
      throw new ApiError(400, structureErrors.join(', '));
    }
    
    if (products.length === 0) {
      throw new ApiError(400, "Excel file contains no product data");
    }
    
    // Clear previous preview products for this supplier
    await PreviewProduct.deleteMany({ supplierId });
    
    const previewProducts = [];
    let validCount = 0;
    let invalidCount = 0;
    
    // Process each product
    for (const productData of products) {
      try {
        // Validate product data
        const { errors, validatedData } = await validateProductData(productData, supplierId);
        
        // Process images
        // Process images with category fallback
let images = [];
if (errors.length === 0) {
  try {
    images = await processProductImages(
      productData.images || [], 
      !!validatedData._id,
      validatedData._id,
      validatedData.categoryId // Pass categoryId for fallback
    );
  } catch (imageError) {
    errors.push(`Failed to process images: ${imageError.message}`);
    
    // Fallback to category image even if processing fails
    try {
      const categoryImage = await getCategoryImage(validatedData.categoryId);
      images = [categoryImage];
      errors.pop(); // Remove the image error since we have a fallback
    } catch (fallbackError) {
      // If category image also fails, keep the original error
      console.error('Category image fallback also failed:', fallbackError.message);
    }
  }
} else {
  // Even for invalid products, try to set a default image for preview
  try {
    const categoryImage = await getCategoryImage(validatedData.categoryId);
    images = [categoryImage];
  } catch (error) {
    images = [{
      url: '/default-product.jpg',
      publicId: `default-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isMain: true
    }];
  }
}
        // Determine if this is an update
        const isUpdate = !!validatedData._id && mongoose.Types.ObjectId.isValid(validatedData._id);
        
        // Create preview product
        const previewProduct = {
          supplierId,
          name: validatedData.name,
          description: validatedData.description || '',
          price: validatedData.price,
          gst: validatedData.gst || 0,
          stockQuantity: validatedData.stockQuantity,
          unit: validatedData.unit || 'kg',
          categoryId: validatedData.categoryId,
          categoryName: validatedData.categoryName,
          images,
          excelRowIndex: validatedData.excelRowIndex,
          isUpdate,
          originalProductId: validatedData._id,
          validationErrors: errors,
          status: errors.length === 0 ? 'valid' : 'invalid'
        };
        console.log("Preview Product:", previewProduct);
        previewProducts.push(previewProduct);
        
        if (errors.length === 0) {
          validCount++;
        } else {
          invalidCount++;
        }
      } catch (error) {
        // If individual product validation fails, still create a preview product with errors
        const previewProduct = {
          supplierId,
          name: productData.name || 'Unknown Product',
          description: productData.description || '',
          price: productData.price || 0,
          gst: productData.gst || 0,
          stockQuantity: productData.stockQuantity || 0,
          unit: productData.unit || 'kg',
          excelRowIndex: productData.excelRowIndex,
          isUpdate: false,
          validationErrors: [`Validation error: ${error.message}`],
          status: 'invalid'
        };
        
        previewProducts.push(previewProduct);
        invalidCount++;
      }
    }
    
    // Save all preview products in batches to avoid large inserts
    const batchSize = 100;
    for (let i = 0; i < previewProducts.length; i += batchSize) {
      const batch = previewProducts.slice(i, i + batchSize);
      await PreviewProduct.insertMany(batch);
    }
    
    return res.status(200).json(
      new ApiResponse(
        200,
        { 
          processedRows: previewProducts.length,
          validRows: validCount,
          invalidRows: invalidCount,
          hasInvalidRows: invalidCount > 0
        },
        "Excel file processed successfully"
      )
    );
    
  } catch (error) {
    // Handle specific Excel parsing errors
    if (error.message.includes('Excel file must contain')) {
      throw new ApiError(400, error.message);
    }
    
    // Handle other errors
    throw new ApiError(500, `Failed to process Excel file: ${error.message}`);
  }
});

// Get preview products
export const getPreviewProducts = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  const { page = 1, limit = 50, status, sortBy = 'excelRowIndex', sortOrder = 'asc' } = req.query;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to view this supplier's preview products");
  }
  
  // Validate pagination parameters
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    throw new ApiError(400, "Page must be a positive integer");
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ApiError(400, "Limit must be a positive integer between 1 and 100");
  }
  
  // Validate sort parameters
  const validSortFields = ['excelRowIndex', 'name', 'price', 'status', 'createdAt'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'excelRowIndex';
  const sortDirection = sortOrder === 'desc' ? -1 : 1;
  
  // Build query
  const query = { supplierId };
  if (status && ['valid', 'invalid', 'pending'].includes(status)) {
    query.status = status;
  }
  
  // Calculate pagination
  const skip = (pageNum - 1) * limitNum;
  
  // Get preview products with pagination
  const previewProducts = await PreviewProduct.find(query)
    // .sort({ [sortField]: sortDirection })
    // .skip(skip)
    // .limit(limitNum);
  
    console.log("Preview Products:", previewProducts);
  // Get total count
  const totalProducts = await PreviewProduct.countDocuments(query);
  
  // Get counts by status
  const validCount = await PreviewProduct.countDocuments({ ...query, status: 'valid' });
  const invalidCount = await PreviewProduct.countDocuments({ ...query, status: 'invalid' });
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        previewProducts,
        counts: {
          valid: validCount,
          invalid: invalidCount,
          total: totalProducts
        },
        pagination: {
          total: totalProducts,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(totalProducts / limitNum)
        }
      },
      "Preview products fetched successfully"
    )
  );
});

// Confirm upload and save products
export const confirmUpload = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  const { processInvalid = false, batchSize = 50 } = req.body;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to confirm upload for this supplier");
  }
  
  // Validate batch size
  const validatedBatchSize = Math.min(Math.max(parseInt(batchSize) || 50, 10), 200);
  
  try {
    // Process products in batches
    const results = await processProductsInBatches(supplierId, processInvalid, validatedBatchSize);
    
    if (results.created === 0 && results.updated === 0 && results.failed > 0) {
      throw new ApiError(500, "Failed to process products. Please check the errors and try again.");
    }
    
    return res.status(200).json(
      new ApiResponse(
        200,
        { results },
        "Products processed successfully"
      )
    );
    
  } catch (error) {
    throw new ApiError(500, `Failed to confirm upload: ${error.message}`);
  }
});

// Delete preview products
export const deletePreviewProducts = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to delete preview products for this supplier");
  }
  
  const result = await PreviewProduct.deleteMany({ supplierId });
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { deletedCount: result.deletedCount },
      "Preview products cleared successfully"
    )
  );
});

// Get upload status and statistics
export const getUploadStatus = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to view upload status for this supplier");
  }
  
  // Get counts by status
  const validCount = await PreviewProduct.countDocuments({ supplierId, status: 'valid' });
  const invalidCount = await PreviewProduct.countDocuments({ supplierId, status: 'invalid' });
  const totalCount = await PreviewProduct.countDocuments({ supplierId });
  
  // Get latest upload timestamp
  const latestUpload = await PreviewProduct.findOne({ supplierId })
    .sort({ createdAt: -1 })
    .select('createdAt');
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { 
        stats: {
          valid: validCount,
          invalid: invalidCount,
          total: totalCount,
          hasData: totalCount > 0
        },
        lastUpload: latestUpload?.createdAt || null
      },
      "Upload status fetched successfully"
    )
  );
});

// Update individual preview product
export const updatePreviewProduct = asyncHandler(async (req, res) => {
  const { supplierId, previewProductId } = req.params;
  const updates = req.body;
  
  // Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to update preview products for this supplier");
  }
  
  // Find the preview product
  const previewProduct = await PreviewProduct.findOne({
    _id: previewProductId,
    supplierId
  });
  
  if (!previewProduct) {
    throw new ApiError(404, "Preview product not found");
  }
  
  // Validate updates
  const allowedUpdates = ['name', 'description', 'price', 'gst', 'stockQuantity', 'unit', 'categoryId', 'categoryName', 'images'];
  const isValidOperation = Object.keys(updates).every(update => allowedUpdates.includes(update));
  
  if (!isValidOperation) {
    throw new ApiError(400, "Invalid updates! Only allowed fields: " + allowedUpdates.join(', '));
  }
  
  // Apply updates
  Object.keys(updates).forEach(update => {
    previewProduct[update] = updates[update];
  });
  
  // Revalidate the product
  const { errors } = await validateProductData(
    {
      name: previewProduct.name,
      description: previewProduct.description,
      price: previewProduct.price,
      gst: previewProduct.gst,
      stockQuantity: previewProduct.stockQuantity,
      unit: previewProduct.unit,
      categoryId: previewProduct.categoryId,
      categoryName: previewProduct.categoryName,
      _id: previewProduct.originalProductId
    },
    supplierId
  );
  
  // Update validation status
  previewProduct.validationErrors = errors;
  previewProduct.status = errors.length === 0 ? 'valid' : 'invalid';
  
  // Save the updated preview product
  await previewProduct.save();
  
  return res.status(200).json(
    new ApiResponse(
      200,
      { previewProduct },
      "Preview product updated successfully"
    )
  );
});

// // Get upload status and statistics
// export const getUploadStatus = asyncHandler(async (req, res) => {
//   const { supplierId } = req.params;
  
//   // Validate supplier access
//   if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
//     throw new ApiError(403, "You are not authorized to view upload status for this supplier");
//   }
  
//   // Get counts by status
//   const validCount = await PreviewProduct.countDocuments({ supplierId, status: 'valid' });
//   const invalidCount = await PreviewProduct.countDocuments({ supplierId, status: 'invalid' });
//   const totalCount = await PreviewProduct.countDocuments({ supplierId });
  
//   // Get latest upload timestamp
//   const latestUpload = await PreviewProduct.findOne({ supplierId })
//     .sort({ createdAt: -1 })
//     .select('createdAt');
  
//   return res.status(200).json(
//     new ApiResponse(
//       200,
//       { 
//         stats: {
//           valid: validCount,
//           invalid: invalidCount,
//           total: totalCount,
//           hasData: totalCount > 0
//         },
//         lastUpload: latestUpload?.createdAt || null
//       },
//       "Upload status fetched successfully"
//     )
//   );
// });