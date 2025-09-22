import express from 'express';
import multer from 'multer';
import {
  generateTemplate,
  parseExcelUpload,
  getPreviewProducts,
  confirmUpload,
  deletePreviewProducts,
  getUploadStatus,
  updatePreviewProduct
} from '../controllers/excelUpload.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';
import { excelUpload } from '../middlewares/multer.middleware.js';


const router = express.Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Error handling for multer
const handleMulterError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size is 10MB.'
      });
    }
  }
  
  if (error.message === 'Only Excel files are allowed') {
    return res.status(400).json({
      status: 'error',
      message: 'Only Excel files (.xlsx) are allowed.'
    });
  }
  
  next(error);
};

// Apply JWT verification to all routes
router.use(verifyJWT);

// Generate Excel template
router.get('/:supplierId/template/:type', generateTemplate);

// Upload and parse Excel file
router.post('/:supplierId/upload', excelUpload.single("excelFile"),handleMulterError,parseExcelUpload)

// Get preview products
router.get('/:supplierId/preview-products', getPreviewProducts);

// Get upload status
router.get('/:supplierId/upload-status', getUploadStatus);

// Update individual preview product
router.patch('/:supplierId/preview-products/:previewProductId', updatePreviewProduct);

// Confirm upload and save products
router.post('/:supplierId/confirm-upload', confirmUpload);

// Delete preview products
router.delete('/:supplierId/preview-products', deletePreviewProducts);

export default router;