import mongoose from 'mongoose';
import Category from '../models/category.model.js';
import { ApiError } from './ApiError.js';

/**
 * Process product images with category fallback
 * @param {Array} images - Array of product images
 * @param {boolean} isUpdate - Whether this is an update operation
 * @param {string} productId - Product ID for updates
 * @param {string} categoryId - Category ID for fallback image
 * @returns {Promise<Array>} - Processed images array
 */
export const processProductImages = async (images = [], isUpdate = false, productId = null, categoryId = null) => {
  try {
    let processedImages = [];

    // If images are provided, process them
    if (images && images.length > 0) {
      processedImages = images.map((img, index) => ({
        url: img.url || '/default-product.jpg',
        publicId: img.publicId || `product-img-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
        isMain: img.isMain || index === 0
      }));
    } else {
      // No images provided, use category image as fallback
      const categoryImage = await getCategoryImage(categoryId);
      processedImages = [categoryImage];
    }

    return processedImages;

  } catch (error) {
    console.error('Error processing product images:', error);
    // Return default image as fallback
    return [{
      url: '/default-product.jpg',
      publicId: `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      isMain: true
    }];
  }
};

/**
 * Fetch category image for use as product default
 * @param {string} categoryId - Category ID
 * @returns {Promise<Object>} - Image object with url and publicId
 */
export const getCategoryImage = async (categoryId) => {
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    return getDefaultImage();
  }

  try {
    const category = await Category.findById(categoryId).select('image name');
    
    if (category && category.image && category.image.url) {
      return {
        url: category.image.url,
        publicId: category.image.publicId || `category-${categoryId}-${Date.now()}`,
        isMain: true,
        source: 'category'
      };
    }
    
    return getDefaultImage();
    
  } catch (error) {
    console.error('Error fetching category image:', error);
    return getDefaultImage();
  }
};

/**
 * Get default product image
 * @returns {Object} - Default image object
 */
export const getDefaultImage = () => {
  return {
    url: '/default-product.jpg',
    publicId: `default-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    isMain: true,
    source: 'default'
  };
};

/**
 * Validate image object structure
 * @param {Object} image - Image object to validate
 * @returns {Array} - Array of validation errors
 */
export const validateImage = (image) => {
  const errors = [];

  if (!image.url) {
    errors.push('Image URL is required');
  }

  if (!image.publicId) {
    errors.push('Image publicId is required');
  }

  if (typeof image.isMain !== 'boolean') {
    errors.push('Image isMain must be a boolean');
  }

  return errors;
};

/**
 * Process multiple images with validation
 * @param {Array} images - Array of image objects
 * @returns {Object} - { processedImages: Array, errors: Array }
 */
export const processMultipleImages = (images) => {
  const processedImages = [];
  const errors = [];

  images.forEach((img, index) => {
    const imageErrors = validateImage(img);
    
    if (imageErrors.length > 0) {
      errors.push(`Image ${index + 1}: ${imageErrors.join(', ')}`);
    } else {
      processedImages.push({
        url: img.url,
        publicId: img.publicId,
        isMain: img.isMain
      });
    }
  });

  // Ensure at least one image is marked as main
  if (processedImages.length > 0 && !processedImages.some(img => img.isMain)) {
    processedImages[0].isMain = true;
  }

  return { processedImages, errors };
};

/**
 * Extract image URLs from product data for preview
 * @param {Array} images - Array of image objects
 * @returns {Array} - Array of image URLs
 */
export const getImageUrls = (images = []) => {
  return images.map(img => img.url).filter(url => url);
};

/**
 * Check if image needs processing (invalid or missing data)
 * @param {Object} image - Image object to check
 * @returns {boolean} - Whether image needs processing
 */
export const needsImageProcessing = (image) => {
  return !image || 
         !image.url || 
         !image.publicId || 
         typeof image.isMain !== 'boolean';
};

export default {
  processProductImages,
  getCategoryImage,
  getDefaultImage,
  validateImage,
  processMultipleImages,
  getImageUrls,
  needsImageProcessing
};