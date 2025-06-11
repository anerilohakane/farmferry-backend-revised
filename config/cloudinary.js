import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: "dh1sgsaf5",
  api_key: "272766161431348",
  api_secret: "MdyI6nEj8jed6lmWhnxDLjkevx4"
});

// console.log("Environment Variables Loaded:", {
//   CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME ? "***exists***" : "MISSING",
//   CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? "***exists***" : "MISSING",
//   CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? "***exists***" : "MISSING"
// });
/**
 * Upload file to Cloudinary
 * @param {string} filePath - Path to the file to upload
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<Object>} - Cloudinary upload response
 */
export const uploadToCloudinary = async (filePath, folder = "farmferry") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto"
    });
    
    return {
      url: result.secure_url,
      public_id: result.public_id
    };
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    throw new Error("Error uploading file to Cloudinary");
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Public ID of the file to delete
 * @returns {Promise<Object>} - Cloudinary delete response
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error("Cloudinary Delete Error:", error);
    throw new Error("Error deleting file from Cloudinary");
  }
};

export default cloudinary;
