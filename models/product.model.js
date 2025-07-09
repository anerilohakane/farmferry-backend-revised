import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    supplierId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: [true, "Supplier ID is required"], 
      ref: "Supplier" 
    },
    categoryId: { 
      type: mongoose.Schema.Types.ObjectId, 
      required: [true, "Category ID is required"], 
      ref: "Category" 
    },
    name: { 
      type: String, 
      required: [true, "Product name is required"], 
      trim: true,
      index: true 
    },
    description: { 
      type: String,
      trim: true 
    },
    price: { 
      type: Number, 
      required: [true, "Price is required"], 
      min: [0, "Price cannot be negative"] 
    },
    stockQuantity: { 
      type: Number, 
      required: [true, "Stock quantity is required"], 
      min: [0, "Stock quantity cannot be negative"] 
    },
    unit: { 
      type: String, 
      enum: ["kg", "g", "liters", "ml", "pcs", "box", "dozen"], 
      default: "kg" 
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          publicId: { type: String, required: true },
          isMain: { type: Boolean, default: false }
        }
      ],
      validate: {
        validator: function(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: 'At least one product image is required'
      },
      required: [true, 'Product images are required']
    },
    
    isActive: { 
      type: Boolean, 
      default: true 
    },
    discountedPrice: { 
      type: Number, 
      min: [0, "Discounted price cannot be negative"],
      validate: {
        validator: function(value) {
          return value <= this.price;
        },
        message: "Discounted price must be less than or equal to regular price"
      }
    },
    offerPercentage: {
      type: Number,
      default: function () {
        if (this.price && this.discountedPrice) {
          return ((this.price - this.discountedPrice) / this.price) * 100;
        }
        return 0;
      },
    },
    
    // Variations
    variations: [
      {
        name: { type: String }, // e.g., "Size", "Weight", "Color"
        value: { type: String }, // e.g., "500g", "1kg", "Red"
        additionalPrice: { type: Number, default: 0 },
        stockQuantity: { type: Number, default: 0 }
      }
    ],
    
    // SKU and Barcode
    sku: { 
      type: String, 
      unique: true,
      sparse: true
    },
    barcode: { 
      type: String, 
      unique: true,
      sparse: true
    },
    
    // Expiry and Freshness
    expiryDate: { 
      type: Date 
    },
    manufactureDate: { 
      type: Date 
    },
    
    // Ratings & Reviews
    averageRating: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 5 
    },
    totalReviews: { 
      type: Number, 
      default: 0 
    },
    
    // Featured & Trending
    isFeatured: { 
      type: Boolean, 
      default: false 
    },
    isTrending: { 
      type: Boolean, 
      default: false 
    },
    
    // Discount Period
    discountStartDate: { 
      type: Date 
    },
    discountEndDate: { 
      type: Date 
    }
  },
  {
    timestamps: true,
  }
);

// Middleware to auto-calculate offer percentage before saving
productSchema.pre("save", function (next) {
  if (this.price > 0 && this.discountedPrice) {
    this.offerPercentage = ((this.price - this.discountedPrice) / this.price) * 100;
  } else {
    this.offerPercentage = 0;
  }
  next();
});

// Virtual for checking if product is in stock
productSchema.virtual('inStock').get(function() {
  return this.stockQuantity > 0;
});

// Method to check if discount is active
productSchema.methods.isDiscountActive = function() {
  const now = new Date();
  if (!this.discountStartDate || !this.discountEndDate) {
    return !!this.discountedPrice;
  }
  return now >= this.discountStartDate && now <= this.discountEndDate;
};

const Product = mongoose.model("Product", productSchema);

export default Product;
