import ExcelJS from 'exceljs';
import Product from '../models/product.model.js';
import PreviewProduct from '../models/previewProduct.model.js';
import Category from '../models/category.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { generateProductTemplate, parseExcelFile } from '../utils/excelUtils.js';
import { processProductImages } from '../utils/imageUtils.js';
import mongoose from 'mongoose';
import { validateProductData} from '../utils/uploadValidation.js';
import { processProductsInBatches}  from '../services/product.service.js';
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
export const parseExcelUpload = asyncHandler(async (req, res) => {
  const { supplierId } = req.params;

  // ✅ Validate supplier access
  if (req.user._id.toString() !== supplierId && req.role !== 'admin') {
    throw new ApiError(403, "You are not authorized to upload products for this supplier");
  }

  if (!req.file) {
    throw new ApiError(400, "Excel file is required");
  }

  // ✅ Validate file type
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    throw new ApiError(400, "Only Excel files (.xlsx) are allowed");
  }

  try {
    // ✅ Parse Excel
    const products = await parseExcelFile(req.file.buffer);

    if (products.length === 0) {
      throw new ApiError(400, "Excel file contains no product data");
    }

    // ✅ Clear previous previews for this supplier
    await PreviewProduct.deleteMany({ supplierId });

    const previewProducts = [];
    let validCount = 0;
    let invalidCount = 0;
    let skippedCount = 0;

    // ✅ Process each product row
    for (const productData of products) {
      // 🔥 Skip instruction or empty rows
      if (
        (!productData.name || productData.name.toLowerCase().includes('instruction')) &&
        !productData.price &&
        !productData.categoryId &&
        !productData.categoryName
      ) {
        console.log(`Skipping row ${productData.excelRowIndex} → instruction/empty row`);
        skippedCount++;
        continue;
      }

      try {
        // Validate
        const { errors, validatedData } = await validateProductData(productData, supplierId);
        console.log("validatedData:", validatedData);

        // ✅ Check if images were provided in Excel (handle both string and array)
        const hasCustomImages = Array.isArray(productData.images) && productData.images.length > 0 ||
                               typeof productData.images === 'string' && productData.images.trim() !== '';

        let images = [];
        
        // ✅ ONLY process images if supplier explicitly provided them in Excel
        if (hasCustomImages && errors.length === 0) {
          try {
            images = await processProductImages(
              productData.images,
              !!validatedData._id,
              validatedData._id,
              validatedData.categoryId
            );
            console.log(`✅ Processed ${images.length} custom images for product: ${validatedData.name}`);
          } catch (imageError) {
            console.error(`❌ Image processing failed for ${validatedData.name}:`, imageError.message);
            // ✅ Add error but DON'T assign any fallback images
            errors.push(`Failed to process images: ${imageError.message}`);
          }
        }
        // ✅ NO else blocks - no category images, no default images

        // ✅ Build previewProduct
        const isUpdate = !!validatedData._id && mongoose.Types.ObjectId.isValid(validatedData._id);
        const previewProduct = {
          supplierId,
          name: validatedData.name,
          description: validatedData.description || '',
          price: validatedData.price,
          gst: validatedData.gst || 0,
          stockQuantity: validatedData.stockQuantity,
          unit: validatedData.unit || 'kg',
          categoryId: validatedData.categoryId || null,
          categoryName: validatedData.categoryName || '',
          images, // ✅ Will be empty array if no images provided by supplier
          excelRowIndex: validatedData.excelRowIndex,
          isUpdate,
          originalProductId: isUpdate ? validatedData._id : null,
          validationErrors: errors,
          status: errors.length === 0 ? 'valid' : 'invalid',
          hasCustomImage: hasCustomImages
        };

        previewProducts.push(previewProduct);

        if (errors.length === 0) validCount++;
        else invalidCount++;

      } catch (error) {
        console.error(`❌ Unexpected error processing product ${productData.name}:`, error);
        
        const previewProduct = {
          supplierId,
          name: productData.name || 'Unknown Product',
          description: productData.description || '',
          price: productData.price || 0,
          gst: productData.gst || 0,
          stockQuantity: productData.stockQuantity || 0,
          unit: productData.unit || 'kg',
          excelRowIndex: productData.excelRowIndex,
          images: [], // ✅ Empty array - no images assigned
          isUpdate: false,
          validationErrors: [`Unexpected error: ${error.message}`],
          status: 'invalid',
          hasCustomImage: false
        };
        previewProducts.push(previewProduct);
        invalidCount++;
      }
    }

    // ✅ Insert preview products in batches
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
          skippedRows: skippedCount,
          hasInvalidRows: invalidCount > 0
        },
        "Excel file processed successfully"
      )
    );

  } catch (error) {
    if (error.message.includes("Excel file must contain")) {
      throw new ApiError(400, error.message);
    }
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

  const validatedBatchSize = Math.min(Math.max(parseInt(batchSize) || 50, 10), 200);

  try {
    const results = await processProductsInBatches(supplierId, processInvalid, validatedBatchSize);

    if (results.failed > 0) {
      console.error("Failed products:", results.errors); // 🔹 log detailed errors
    }

    const message =
      results.failed > 0
        ? "Products processed with some errors"
        : "Products processed successfully";

    return res.status(200).json(
      new ApiResponse(
        200,
        { results, failedProducts: results.errors },
        message
      )
    );
  } catch (error) {
    console.error("Confirm upload error:", error);
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