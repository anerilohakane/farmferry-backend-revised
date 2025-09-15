import dotenv from "dotenv";
import { connectDB } from "./config/database.js";
import DeliveryAssociate from "./models/deliveryAssociate.model.js";

// Load environment variables
dotenv.config();

const createTestDeliveryAssociate = async () => {
  try {
    // Connect to database
    await connectDB();
    
    const testPhone = "9876543210"; // Use this phone number for testing
    
    // Check if associate already exists
    const existingAssociate = await DeliveryAssociate.findOne({ phone: testPhone });
    
    if (existingAssociate) {
      console.log(`✅ Test delivery associate already exists!`);
      console.log(`Phone: ${testPhone}`);
      console.log(`Name: ${existingAssociate.name}`);
      console.log(`Email: ${existingAssociate.email}`);
      process.exit(0);
    }
    
    // Create test delivery associate
    const associate = await DeliveryAssociate.create({
      name: "Test Delivery Associate",
      email: "test.delivery@farmferry.com",
      phone: testPhone,
      password: "test123", // This will be hashed automatically by the model
      role: "deliveryAssociate",
      isVerified: true,
      isActive: true,
      isOnline: false,
      vehicle: {
        type: "motorcycle",
        model: "Honda Activa",
        registrationNumber: "DL01AB1234",
        color: "Black"
      },
      address: {
        street: "123 Test Street",
        city: "Test City",
        state: "Test State",
        postalCode: "12345",
        country: "India"
      }
    });
    
    console.log(`✅ Created test delivery associate successfully!`);
    console.log(`Phone: ${associate.phone}`);
    console.log(`Name: ${associate.name}`);
    console.log(`Email: ${associate.email}`);
    console.log(`\n🎉 You can now test OTP login with phone number: ${testPhone}`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Error creating test delivery associate:", error);
    process.exit(1);
  }
};

createTestDeliveryAssociate();
