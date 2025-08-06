import crypto from "crypto";
import jwt from "jsonwebtoken";
import Customer from "../models/customer.model.js";
import Supplier from "../models/supplier.model.js";
import Admin from "../models/admin.model.js";
import DeliveryAssociate from "../models/deliveryAssociate.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import sendEmail from "../utils/email.js";
import smsUtils from "../utils/sms.js";

// Helper function to generate tokens and save to cookies
const generateTokensAndSetCookies = async (user, res) => {
  try {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    
    // Set cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' ? true : false,
    };
    
    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });
    
    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "Error generating tokens");
  }
};

// Customer Registration
export const registerCustomer = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  
  // Validate required fields
  if (!name || !email || !password || !phone) {
    throw new ApiError(400, "Name, email, phone, and password are required");
  }
  
  // Check if email already exists
  const existingCustomer = await Customer.findOne({ email: email.toLowerCase() });
  if (existingCustomer) {
    throw new ApiError(409, "Email is already registered");
  }
  
  // Check if phone already exists
  const existingPhone = await Customer.findOne({ phone });
  if (existingPhone) {
    throw new ApiError(409, "Phone number is already registered");
  }
  
  // Split name into firstName and lastName
  const nameParts = name.trim().split(' ');
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(' ') || '';
  
  // Generate phone verification OTP
  const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Create new customer with phone verification pending
  const customer = await Customer.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    password,
    phone,
    phoneOTP,
    phoneOTPExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
    isPhoneVerified: false,
    lastLogin: new Date()
  });
  
  // Remove sensitive fields from response
  const createdCustomer = await Customer.findById(customer._id).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!createdCustomer) {
    throw new ApiError(500, "Something went wrong while registering the customer");
  }
  
  // Don't generate tokens until phone verification is complete
  // const { accessToken, refreshToken } = await generateTokensAndSetCookies(customer, res);
  
  // Send welcome email
  try {
    await sendEmail({
      to: createdCustomer.email,
      subject: "Welcome to FarmFerry!",
      html: `
        <h1>Welcome, ${createdCustomer.firstName}!</h1>
        <p>Thank you for registering with FarmFerry. We're excited to have you.</p>
        <p>You can now browse our wide range of fresh products directly from local suppliers.</p>
        <a href="${process.env.FRONTEND_URL}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Shop Now</a>
      `,
    });
  } catch (error) {
    console.error("Error sending welcome email:", error);
  }

  // Send phone verification OTP
  let smsSent = false;
  try {
    await smsUtils.sendSMS(
      createdCustomer.phone,
      `Your FarmFerry verification OTP is: ${phoneOTP}. Valid for 10 minutes.`
    );
    smsSent = true;
  } catch (error) {
    console.error("Error sending phone verification OTP:", error);
    // Don't fail registration if SMS fails, but log it
  }
  
  // Send response - require phone verification before login
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        customer: {
          _id: createdCustomer._id,
          firstName: createdCustomer.firstName,
          lastName: createdCustomer.lastName,
          email: createdCustomer.email,
          phone: createdCustomer.phone,
          isPhoneVerified: createdCustomer.isPhoneVerified
        },
        requiresPhoneVerification: true // Always require phone verification
      },
      smsSent 
        ? "Customer registered successfully. Please verify your phone number with the OTP sent to your mobile."
        : "Customer registered successfully. Please verify your phone number to continue."
    )
  );
});

// Customer Login
export const loginCustomer = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  
  // Find customer
  const customer = await Customer.findOne({ email: email.toLowerCase() });
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }
  
  // Verify password
  const isPasswordValid = await customer.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  
  // Check if phone is verified
  if (!customer.isPhoneVerified) {
    // Generate new OTP if needed
    if (!customer.phoneOTP || customer.phoneOTPExpires < Date.now()) {
      const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString();
      customer.phoneOTP = phoneOTP;
      customer.phoneOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await customer.save({ validateBeforeSave: false });
      
      // Try to send SMS
      try {
        await smsUtils.sendSMS(
          customer.phone,
          `Your FarmFerry verification OTP is: ${phoneOTP}. Valid for 10 minutes.`
        );
      } catch (error) {
        console.error("Error sending verification SMS:", error);
      }
    }
    
    return res.status(403).json(
      new ApiResponse(
        403,
        {
          customer: {
            _id: customer._id,
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            isPhoneVerified: customer.isPhoneVerified
          },
          requiresPhoneVerification: true
        },
        "Phone verification required. Please verify your phone number with the OTP sent to your mobile."
      )
    );
  }
  
  // Update last login
  customer.lastLogin = new Date();
  await customer.save();
  
  // Get customer without sensitive fields
  const loggedInCustomer = await Customer.findById(customer._id).select("-password -passwordResetToken -passwordResetExpires");
  
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(customer, res);
  
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        customer: loggedInCustomer,
        accessToken,
        refreshToken
      },
      "Customer logged in successfully"
    )
  );
});

// Admin Registration
// Admin Registration
export const registerAdmin = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role = "admin", permissions } = req.body;
  console.log(req.body);

  if (!name || !email || !password) {
    throw new ApiError(400, "email, name, password are required");
  }

  const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
  if (existingAdmin) {
    throw new ApiError(409, "Email is already registered");
  }

  const [firstName, ...lastNameParts] = name.trim().split(" ");
  const lastName = lastNameParts.join(" ");

  const admin = await Admin.create({
    name: { firstName, lastName },
    email: email.toLowerCase(),
    password,
    phone,
    role,
    permissions,
    lastLogin: new Date()
  });

  const createdAdmin = await Admin.findById(admin._id).select(
    "-password -passwordResetToken -passwordResetExpires"
  );

  if (!createdAdmin) {
    throw new ApiError(500, "Something went wrong while registering the admin");
  }

  const { accessToken, refreshToken } = await generateTokensAndSetCookies(admin, res);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        admin: createdAdmin,
        accessToken,
        refreshToken
      },
      "Admin registered successfully"
    )
  );
});

// Supplier Registration
export const registerSupplier = asyncHandler(async (req, res) => {
  const { 
    businessName, 
    ownerName, 
    email, 
    password, 
    phone, 
    businessType,
    address
  } = req.body;
  console.log(req.body);
  // Validate required fields
  
  
  // Check if email already exists
  const existingSupplier = await Supplier.findOne({ email: email.toLowerCase() });
  if (existingSupplier) {
    throw new ApiError(409, "Email is already registered");
  }
  
  // Create new supplier
  const supplier = await Supplier.create({
    businessName,
    ownerName,
    email: email.toLowerCase(),
    password,
    phone,
    businessType,
    address,
    status: "pending",
    lastLogin: new Date()
  });
  
  // Remove sensitive fields from response
  const createdSupplier = await Supplier.findById(supplier._id).select("-password -passwordResetToken -passwordResetExpires");
  
  if (!createdSupplier) {
    throw new ApiError(500, "Something went wrong while registering the supplier");
  }
  
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(supplier, res);
  
  // Send response
  return res.status(201).json(
    new ApiResponse(
      201,
      {
        supplier: createdSupplier,
        accessToken,
        refreshToken
      },
      "Supplier registered successfully. Your account is pending verification."
    )
  );
});

// Supplier Login
export const loginSupplier = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  
  // Find supplier
  const supplier = await Supplier.findOne({ email: email.toLowerCase() });
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  
  // Verify password
  const isPasswordValid = await supplier.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  
  // Update last login
  supplier.lastLogin = new Date();
  await supplier.save();
  
  // Get supplier without sensitive fields
  const loggedInSupplier = await Supplier.findById(supplier._id).select("-password -passwordResetToken -passwordResetExpires");
  
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(supplier, res);
  
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: loggedInSupplier,
        accessToken,
        refreshToken
      },
      "Supplier logged in successfully"
    )
  );
});

// Admin Login
export const loginAdmin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  
  // Find admin
  const admin = await Admin.findOne({ email: email.toLowerCase() });
  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }
  
  // Verify password
  const isPasswordValid = await admin.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  
  // Update last login
  admin.lastLogin = new Date();
  await admin.save();
  
  // Get admin without sensitive fields
  const loggedInAdmin = await Admin.findById(admin._id).select("-password -passwordResetToken -passwordResetExpires");
  
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(admin, res);
  
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        admin: loggedInAdmin,
        accessToken,
        refreshToken
      },
      "Admin logged in successfully"
    )
  );
});

// Logout
export const logout = asyncHandler(async (req, res) => {
  // Clear cookies
  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");
  
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Logged out successfully"
    )
  );
});

// Refresh Access Token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  // Get refresh token from cookies
  const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }
  
  try {
    // Verify refresh token
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Find user
    let user;
    if (req.body.role === "admin") {
      user = await Admin.findById(decodedToken.id);
    } else if (req.body.role === "supplier") {
      user = await Supplier.findById(decodedToken.id);
    } else {
      user = await Customer.findById(decodedToken.id);
    }
    
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    
    // Generate new tokens
    const { accessToken, refreshToken } = await generateTokensAndSetCookies(user, res);
    
    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        { accessToken, refreshToken },
        "Access token refreshed"
      )
    );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

// Forgot Password
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, role = "customer" } = req.body;
  
  if (!email) {
    throw new ApiError(400, "Email is required");
  }
  
  // Find user based on role
  let user;
  if (role === "admin") {
    user = await Admin.findOne({ email: email.toLowerCase() });
  } else if (role === "supplier") {
    user = await Supplier.findOne({ email: email.toLowerCase() });
  } else {
    user = await Customer.findOne({ email: email.toLowerCase() });
  }
  
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  
  // Generate reset token or OTP based on role
  if (role === "customer") {
    // For customers, generate OTP
    const resetOTP = user.generatePasswordResetOTP();
    await user.save({ validateBeforeSave: false });

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset OTP",
        html: `
          <h1>Password Reset OTP</h1>
          <p>You are receiving this email because you (or someone else) has requested the reset of your password.</p>
          <p>Your password reset OTP is: <strong style="font-size: 24px; color: #28a745; letter-spacing: 2px;">${resetOTP}</strong></p>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending password reset OTP email:", error);
      throw new ApiError(500, "There was an error sending the email. Please try again later.");
    }
    
    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset OTP sent to email"
      )
    );
  } else {
    // For admin and supplier, use token (existing logic)
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });
    
    // Create reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetURL = `${frontendUrl}/reset-password/${resetToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: "Password Reset Request",
        html: `
          <h1>Password Reset Request</h1>
          <p>You are receiving this email because you (or someone else) has requested the reset of a password.</p>
          <p>Please click on the following link, or paste this into your browser to complete the process:</p>
          <a href="${resetURL}" style="display: inline-block; padding: 10px 20px; background-color: #28a745; color: #fff; text-decoration: none; border-radius: 5px;">Reset Password</a>
          <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        `,
      });
    } catch (error) {
      console.error("Error sending password reset email:", error);
      throw new ApiError(500, "There was an error sending the email. Please try again later.");
    }
    
    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset instructions sent to email"
      )
    );
  }
});

// Reset Password
export const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password, role = "customer", otp } = req.body;
  
  if (role === "customer") {
    // For customers, use OTP
    if (!otp || !password) {
      throw new ApiError(400, "OTP and password are required");
    }
    
    // Find customer with valid OTP
    const user = await Customer.findOne({
      passwordResetOTP: otp,
      passwordResetOTPExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      throw new ApiError(400, "OTP is invalid or has expired");
    }
    
    // Update password and clear OTP
    user.password = password;
    user.passwordResetOTP = undefined;
    user.passwordResetOTPExpires = undefined;
    await user.save();
    
    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset successful"
      )
    );
  } else {
    // For admin and supplier, use token (existing logic)
    if (!token || !password) {
      throw new ApiError(400, "Token and password are required");
    }
    
    // Hash the token
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    
    // Find user based on role
    let user;
    if (role === "admin") {
      user = await Admin.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
    } else if (role === "supplier") {
      user = await Supplier.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
      });
    }
    
    if (!user) {
      throw new ApiError(400, "Token is invalid or has expired");
    }
    
    // Update password
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    // Send response
    return res.status(200).json(
      new ApiResponse(
        200,
        {},
        "Password reset successful"
      )
    );
  }
});

// Reset Password with OTP (for customers)
export const resetPasswordWithOTP = asyncHandler(async (req, res) => {
  const { email, otp, password } = req.body;
  
  if (!email || !otp || !password) {
    throw new ApiError(400, "Email, OTP and password are required");
  }
  
  // Find customer with valid OTP
  const user = await Customer.findOne({
    email: email.toLowerCase(),
    passwordResetOTP: otp,
    passwordResetOTPExpires: { $gt: Date.now() }
  });
  
  if (!user) {
    throw new ApiError(400, "OTP is invalid or has expired");
  }
  
  // Update password and clear OTP
  user.password = password;
  user.passwordResetOTP = undefined;
  user.passwordResetOTPExpires = undefined;
  await user.save();
  
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Password reset successful"
    )
  );
});

// Send Phone Verification OTP
export const sendPhoneVerification = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    throw new ApiError(400, "Phone number is required");
  }

  // First try to find customer
  let customer = await Customer.findOne({ phone });

  if (customer) {
    // Generate new phone verification OTP for customer
    const phoneOTP = Math.floor(100000 + Math.random() * 900000).toString();
    customer.phoneOTP = phoneOTP;
    customer.phoneOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await customer.save({ validateBeforeSave: false });

    try {
      await smsUtils.sendSMS(
        customer.phone,
        `Your FarmFerry verification OTP is: ${phoneOTP}. Valid for 10 minutes.`
      );
    } catch (error) {
      console.error("Error sending verification SMS:", error);
      throw new ApiError(500, "There was an error sending the SMS. Please try again later.");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Verification OTP sent successfully"));
  }

  // If not customer, try supplier
  const supplier = await Supplier.findOne({ phone });

  if (supplier) {
    const otp = supplier.generatePhoneVerificationToken();
    await supplier.save({ validateBeforeSave: false });

    try {
      await sendSMS(
        supplier.phone,
        `Your FarmFerry verification code is: ${otp}`
      );
    } catch (error) {
      console.error("Error sending verification SMS:", error);
      throw new ApiError(500, "There was an error sending the SMS. Please try again later.");
    }

    return res.status(200).json(new ApiResponse(200, {}, "Verification OTP sent successfully"));
  }

  throw new ApiError(404, "User not found with this phone number");
});

// Verify Phone OTP
export const verifyPhone = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    throw new ApiError(400, "Phone number and OTP are required");
  }

  const supplier = await Supplier.findOne({
    phone,
    phoneVerificationToken: otp,
    phoneVerificationExpires: { $gt: Date.now() },
  });

  if (!supplier) {
    throw new ApiError(400, "Invalid OTP or OTP has expired");
  }

  supplier.isPhoneVerified = true;
  supplier.phoneVerificationToken = undefined;
  supplier.phoneVerificationExpires = undefined;
  await supplier.save({ validateBeforeSave: false });

  return res.status(200).json(new ApiResponse(200, {}, "Phone number verified successfully"));
});

// Change Password
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }
  
  // Get user from request
  const user = await req.user.constructor.findById(req.user._id);
  
  // Verify current password
  const isPasswordValid = await user.isPasswordCorrect(currentPassword);
  if (!isPasswordValid) {
    throw new ApiError(401, "Current password is incorrect");
  }
  
  // Update password
  user.password = newPassword;
  await user.save();
  
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {},
      "Password changed successfully"
    )
  );
});

// Delivery Associate Login
export const loginDeliveryAssociate = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;

  if (!phone || !password) {
    throw new ApiError(400, "Phone and password are required");
  }

  const deliveryAssociate = await DeliveryAssociate.findOne({ phone });
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }

  const isPasswordValid = await deliveryAssociate.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  deliveryAssociate.lastLogin = new Date();
  await deliveryAssociate.save();

  const { accessToken, refreshToken } = await generateTokensAndSetCookies(deliveryAssociate, res);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: {
          _id: deliveryAssociate._id,
          name: deliveryAssociate.name,
          email: deliveryAssociate.email,
          phone: deliveryAssociate.phone,
          isVerified: deliveryAssociate.isVerified,
          vehicle: deliveryAssociate.vehicle,
        },
        token: accessToken,
        refreshToken,
      },
      "Delivery associate logged in successfully"
    )
  );
});

export const getDeliveryAssociateMe = asyncHandler(async (req, res) => {
  const deliveryAssociate = await DeliveryAssociate.findById(req.user.id).select("-password -passwordResetToken -passwordResetExpires");
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate not found");
  }
  return res.status(200).json(
    new ApiResponse(
      200,
      deliveryAssociate,
      "Delivery associate profile fetched successfully"
    )
  );
});

// Send Phone Verification OTP for Delivery Associate
export const sendDeliveryAssociatePhoneVerification = asyncHandler(async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    // throw new ApiError(400, "Phone number is required");
  }

  const deliveryAssociate = await DeliveryAssociate.findOne({ phone });
  if (!deliveryAssociate) {
    throw new ApiError(404, "Delivery associate with this phone number not found");
  }

  const otp = deliveryAssociate.generatePhoneVerificationToken();
  await deliveryAssociate.save({ validateBeforeSave: false });

  try {
    await smsUtils.sendSMS(
      deliveryAssociate.phone,
      `Your FarmFerry verification code is: ${otp}`
    );
    return res.status(200).json(new ApiResponse(200, {}, "Verification OTP sent successfully"));
  } catch (error) {
    console.error("Error sending SMS:", error);
    // Clear OTP fields if SMS fails
    deliveryAssociate.phoneVerificationToken = undefined;
    deliveryAssociate.phoneVerificationTokenExpires = undefined;
    await deliveryAssociate.save({ validateBeforeSave: false });
    throw new ApiError(500, "Failed to send OTP. Please try again later.");
  }
});

// Verify Phone OTP
export const verifyPhoneOTP = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    throw new ApiError(400, "Phone number and OTP are required");
  }

  // First try to find customer
  let customer = await Customer.findOne({
    phone,
    phoneOTP: otp,
    phoneOTPExpires: { $gt: Date.now() },
  });

  if (customer) {
    customer.isPhoneVerified = true;
    customer.phoneOTP = undefined;
    customer.phoneOTPExpires = undefined;
    await customer.save({ validateBeforeSave: false });

    return res.status(200).json(
      new ApiResponse(200, { 
        user: customer,
        userType: "customer"
      }, "Phone number verified successfully")
    );
  }

  // If not customer, try delivery associate
  const deliveryAssociate = await DeliveryAssociate.findOne({
    phone,
    phoneVerificationToken: otp,
    phoneVerificationExpires: { $gt: Date.now() },
  });

  if (deliveryAssociate) {
    deliveryAssociate.isPhoneVerified = true;
    deliveryAssociate.phoneVerificationToken = undefined;
    deliveryAssociate.phoneVerificationExpires = undefined;
    await deliveryAssociate.save({ validateBeforeSave: false });

    return res.status(200).json(
      new ApiResponse(200, { 
        user: deliveryAssociate,
        userType: "deliveryAssociate"
      }, "Phone number verified successfully")
    );
  }

  throw new ApiError(400, "Invalid OTP or OTP has expired");
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  if (!req.user || !req.user._id) {
    throw new ApiError(401, "User not authenticated");
  }

  let user;
  let userType;

  // Try to find user in each collection
  user = await Customer.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
  if (user) userType = "customer";
  if (!user) {
    user = await Supplier.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
    if (user) userType = "supplier";
  }
  if (!user) {
    user = await Admin.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
    if (user) userType = "admin";
  }
  if (!user) {
    user = await DeliveryAssociate.findById(req.user._id).select("-password -passwordResetToken -passwordResetExpires");
    if (user) userType = "deliveryAssociate";
  }

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return res.status(200).json(
    new ApiResponse(200, { user, userType }, "Current user fetched successfully")
  );
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "updateAccountDetails placeholder"));
});

export const updateUserAvatar = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "updateUserAvatar placeholder"));
});

export const updateUserCoverImage = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "updateUserCoverImage placeholder"));
});

export const getUserChannelProfile = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "getUserChannelProfile placeholder"));
});

export const getWatchHistory = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, {}, "getWatchHistory placeholder"));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  // Validate required fields
  if (!email || !password) {
    throw new ApiError(400, "Email and password are required");
  }
  // Find supplier
  const supplier = await Supplier.findOne({ email: email.toLowerCase() });
  if (!supplier) {
    throw new ApiError(404, "Supplier not found");
  }
  // Verify password
  const isPasswordValid = await supplier.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }
  // Update last login
  supplier.lastLogin = new Date();
  await supplier.save();
  // Get supplier without sensitive fields
  const loggedInSupplier = await Supplier.findById(supplier._id).select("-password -passwordResetToken -passwordResetExpires");
  // Generate tokens
  const { accessToken, refreshToken } = await generateTokensAndSetCookies(supplier, res);
  // Send response
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: loggedInSupplier,
        accessToken,
        refreshToken
      },
      "Supplier logged in successfully"
    )
  );
});
