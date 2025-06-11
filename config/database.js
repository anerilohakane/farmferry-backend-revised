import mongoose from "mongoose";

/**
 * Connect to MongoDB database
 * @returns {Promise<void>}
 */
export const connectDB = async () => {
  try {
    const connectionString = `${process.env.MONGO_DB_URI}/${process.env.DB_NAME}`;
    
    const conn = await mongoose.connect(connectionString, {
      // Connection options are automatically handled in newer mongoose versions
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};
