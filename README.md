# FarmFerry Backend API

FarmFerry is a comprehensive e-commerce platform connecting farmers and suppliers directly with customers, providing fresh agricultural products with efficient delivery.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Authentication](#authentication)
- [Models](#models)
- [Controllers](#controllers)
- [Routes](#routes)
- [Middleware](#middleware)
- [Utilities](#utilities)
- [License](#license)

## Features

- **Multi-user Authentication**: Separate authentication flows for customers, suppliers, and admins
- **Product Management**: Comprehensive product catalog with categories, variations, and inventory management
- **Order Processing**: Complete order lifecycle from cart to delivery
- **Review System**: Product reviews with ratings, images, and supplier responses
- **Supplier Management**: Supplier onboarding, verification, and dashboard
- **Delivery System**: Delivery associate management with real-time tracking
- **Admin Dashboard**: Comprehensive admin controls and analytics
- **Media Management**: Cloudinary integration for image uploads
- **Security**: JWT-based authentication, password hashing, and role-based access control

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer and Cloudinary
- **Security**: bcrypt for password hashing
- **Environment**: dotenv for environment variables

## Project Structure

```
farmferry-backend/
├── config/               # Configuration files
│   ├── cloudinary.js     # Cloudinary configuration
│   └── database.js       # MongoDB connection
├── controllers/          # Request handlers
├── middlewares/          # Custom middleware
├── models/               # Mongoose schemas
├── public/               # Static files
├── routes/               # API routes
├── utils/                # Utility functions
├── .env                  # Environment variables
├── app.js                # Express app setup
├── server.js             # Server entry point
└── package.json          # Project dependencies
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- Cloudinary account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/farmferry-backend.git
   cd farmferry-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   npm run setup
   ```
   This will create a `.env` file with default values. Please update it with your actual values:
   - Replace JWT secrets with secure random strings
   - Update email configuration if you want to send actual emails
   - Update Cloudinary configuration if you want to use image uploads

4. Start the development server:
   ```bash
   npm run dev
   ```

5. The API will be available at `http://localhost:9000`

## Environment Variables

### Email Configuration
For password reset functionality to work, you need to configure email settings:

1. **Gmail Setup** (Recommended for development):
   - Enable 2-factor authentication on your Gmail account
   - Generate an App Password: https://myaccount.google.com/apppasswords
   - Use the App Password in `EMAIL_PASSWORD` (not your regular password)

2. **Other Email Providers**:
   - Update `EMAIL_SERVICE` to your provider (e.g., 'outlook', 'yahoo')
   - Use appropriate SMTP settings

3. **Development Mode**:
   - If email is not configured, the system will log email content to console instead of sending actual emails

```
# Server Configuration
PORT=9000
NODE_ENV=development

# MongoDB Configuration
MONGO_DB_URI=mongodb://localhost:27017
DB_NAME=farmferry

# JWT Configuration
ACCESS_TOKEN_SECRET=your_access_token_secret
REFRESH_TOKEN_SECRET=your_refresh_token_secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_EXPIRY=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Configuration (for password reset functionality)
EMAIL_SERVICE=gmail
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=FarmFerry <your-email@gmail.com>
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication with two types of tokens:

- **Access Token**: Short-lived token for API access (1 day)
- **Refresh Token**: Long-lived token for refreshing access tokens (7 days)

Authentication flow:
1. User registers or logs in
2. Server issues access and refresh tokens
3. Client includes access token in Authorization header
4. When access token expires, client uses refresh token to get a new access token

## Models

### Core Models

- **Customer**: End users who purchase products
- **Supplier**: Farmers and vendors who sell products
- **Admin**: System administrators
- **DeliveryAssociate**: Delivery personnel

### Product Models

- **Product**: Product details, inventory, pricing, and images
- **Category**: Hierarchical product categories

### Order Models

- **Cart**: Shopping cart with items and pricing
- **Order**: Order details, payment, and delivery information
- **Review**: Product reviews and ratings

## Controllers

- **Auth Controller**: Registration, login, logout, token refresh, password management
- **Customer Controller**: Profile management, addresses, wishlist, orders
- **Supplier Controller**: Profile management, product management, order fulfillment
- **Product Controller**: CRUD operations for products
- **Category Controller**: CRUD operations for categories
- **Order Controller**: Order creation, management, and status updates
- **Cart Controller**: Cart management and checkout
- **Review Controller**: Product reviews and ratings
- **Admin Controller**: User management, analytics, and system configuration
- **DeliveryAssociate Controller**: Profile management, order delivery, and tracking

## Routes

All routes are prefixed with `/api/v1`

- **Auth Routes**: `/auth/*`
- **Customer Routes**: `/customers/*`
- **Supplier Routes**: `/suppliers/*`
- **Product Routes**: `/products/*`
- **Category Routes**: `/categories/*`
- **Order Routes**: `/orders/*`
- **Cart Routes**: `/cart/*`
- **Review Routes**: `/reviews/*`
- **Admin Routes**: `/admin/*`
- **Delivery Associate Routes**: `/delivery-associates/*`

## Middleware

- **Authentication**: Verify JWT tokens and attach user to request
- **Authorization**: Role-based access control
- **Error Handling**: Global error handling middleware
- **File Upload**: Multer middleware for handling file uploads

## Utilities

- **ApiResponse**: Standardized API response format
- **ApiError**: Custom error handling
- **AsyncHandler**: Async/await error handling wrapper

## License

This project is licensed under the ISC License.
