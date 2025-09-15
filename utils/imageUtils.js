import { uploadToCloudinary } from '../config/cloudinary.js';

// Default product image
const DEFAULT_IMAGE_URL = 'https://res.cloudinary.com/your-cloud/image/upload/v1234567890/default-product.jpg';

/**
 * Processes image URLs from Excel and uploads new images to Cloudinary
 * @param {Array} imageUrls - Array of image URLs from Excel
 * @param {boolean} isUpdate - Whether this is an update operation
 * @returns {Promise<Array>} Array of image objects with url and publicId
 */
export const processProductImages = async (imageUrls = [], isUpdate = false) => {
  const processedImages = [];
  
  // If no images provided, use default image
  if (!imageUrls || imageUrls.length === 0) {
    return [{ url: DEFAULT_IMAGE_URL, isMain: true }];
  }
  
  // Process each image URL
  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    const isMain = i === 0;
    
    try {
      // Check if URL is already a Cloudinary URL or external URL
      if (imageUrl.includes('cloudinary.com') || imageUrl.startsWith('http')) {
        // External URL, use as-is
        processedImages.push({
          url: imageUrl,
          isMain
        });
      } else {
        // Local file path or base64 - upload to Cloudinary
        // Note: This would need to be adapted based on how files are handled
        // For now, we'll assume URLs are provided
        processedImages.push({
          url: imageUrl,
          isMain
        });
      }
    } catch (error) {
      console.error(`Error processing image ${imageUrl}:`, error);
      // If image processing fails, use default image for main image
      if (isMain) {
        processedImages.push({
          url: DEFAULT_IMAGE_URL,
          isMain: true
        });
      }
    }
  }
  
  return processedImages;
};

/**
 * Extracts image URLs from product images array
 * @param {Array} images - Array of image objects
 * @returns {string} Comma-separated image URLs
 */
export const imagesToString = (images = []) => {
  return images.map(img => img.url).join(', ');
};