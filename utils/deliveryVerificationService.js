import crypto from 'crypto';
import sendSMS from './sms.js';
import sendEmail from './email.js';
import QRCodeService from './qrCodeService.js';

/**
 * Delivery Verification Service for OTP-based delivery confirmation
 */
export class DeliveryVerificationService {
  constructor() {
    this.otpExpiryMinutes = 10; // OTP expires in 10 minutes
  }

  /**
   * Generate delivery OTP and send to customer
   * @param {string} orderId - Order ID
   * @param {string} customerPhone - Customer phone number
   * @param {string} customerEmail - Customer email
   * @param {string} deliveryAssociateId - Delivery associate ID
   * @returns {Promise<Object>} OTP data
   */
  async generateDeliveryOTP(orderId, customerPhone, customerEmail, deliveryAssociateId) {
    try {
      // Generate 6-digit OTP
      const otp = this.generateOTP();
      
      // Create delivery verification record
      const verificationData = {
        orderId: orderId,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        deliveryAssociateId: deliveryAssociateId,
        otp: otp,
        otpExpiresAt: new Date(Date.now() + (this.otpExpiryMinutes * 60 * 1000)),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date()
      };

      // Send OTP via SMS
      if (customerPhone) {
        await this.sendDeliveryOTPSMS(customerPhone, otp, orderId);
      }

      // Send OTP via Email
      if (customerEmail) {
        await this.sendDeliveryOTPEmail(customerEmail, otp, orderId);
      }

      // Generate QR code for delivery
      const qrCodeData = await QRCodeService.generateDeliveryQRCode(
        orderId, 
        customerPhone, 
        deliveryAssociateId
      );

      return {
        ...verificationData,
        qrCode: qrCodeData.qrCodeDataURL,
        deliveryToken: qrCodeData.deliveryToken
      };
    } catch (error) {
      console.error('Delivery OTP generation error:', error);
      throw new Error('Failed to generate delivery OTP');
    }
  }

  /**
   * Generate replacement OTP and send to customer
   * @param {string} orderId - Original order ID
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} customerPhone - Customer phone number
   * @param {string} customerEmail - Customer email
   * @returns {Promise<Object>} OTP data
   */
  async generateReplacementOTP(orderId, replacementOrderId, customerPhone, customerEmail) {
    try {
      // Generate 6-digit OTP
      const otp = this.generateOTP();
      
      // Create replacement verification record
      const verificationData = {
        originalOrderId: orderId,
        replacementOrderId: replacementOrderId,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        otp: otp,
        otpExpiresAt: new Date(Date.now() + (this.otpExpiryMinutes * 60 * 1000)),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        type: 'replacement',
        createdAt: new Date()
      };

      // Send OTP via SMS
      if (customerPhone) {
        await this.sendReplacementOTPSMS(customerPhone, otp, replacementOrderId);
      }

      // Send OTP via Email
      if (customerEmail) {
        await this.sendReplacementOTPEmail(customerEmail, otp, replacementOrderId);
      }

      // Generate QR code for replacement
      const qrCodeData = await QRCodeService.generateReplacementQRCode(
        orderId,
        replacementOrderId,
        customerPhone
      );

      return {
        ...verificationData,
        qrCode: qrCodeData.qrCodeDataURL,
        replacementToken: qrCodeData.replacementToken
      };
    } catch (error) {
      console.error('Replacement OTP generation error:', error);
      throw new Error('Failed to generate replacement OTP');
    }
  }

  /**
   * Verify delivery OTP
   * @param {string} orderId - Order ID
   * @param {string} otp - OTP entered by delivery associate
   * @param {string} customerPhone - Customer phone number
   * @returns {Promise<Object>} Verification result
   */
  async verifyDeliveryOTP(orderId, otp, customerPhone) {
    try {
      // In a real implementation, you would fetch this from database
      // For now, we'll simulate the verification process
      
      // Validate OTP format
      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP format');
      }

      // Check if OTP is expired
      const currentTime = new Date();
      const otpExpiresAt = new Date(); // This would come from database
      
      if (currentTime > otpExpiresAt) {
        throw new Error('OTP has expired');
      }

      // Verify OTP (in real implementation, compare with stored OTP)
      const isValidOTP = await this.validateStoredOTP(orderId, otp, customerPhone);
      
      if (!isValidOTP) {
        throw new Error('Invalid OTP');
      }

      return {
        success: true,
        message: 'OTP verified successfully',
        orderId: orderId,
        verifiedAt: new Date()
      };
    } catch (error) {
      console.error('Delivery OTP verification error:', error);
      throw error;
    }
  }

  /**
   * Verify replacement OTP
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} otp - OTP entered by customer
   * @param {string} customerPhone - Customer phone number
   * @returns {Promise<Object>} Verification result
   */
  async verifyReplacementOTP(replacementOrderId, otp, customerPhone) {
    try {
      // Validate OTP format
      if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP format');
      }

      // Check if OTP is expired
      const currentTime = new Date();
      const otpExpiresAt = new Date(); // This would come from database
      
      if (currentTime > otpExpiresAt) {
        throw new Error('OTP has expired');
      }

      // Verify OTP (in real implementation, compare with stored OTP)
      const isValidOTP = await this.validateStoredReplacementOTP(replacementOrderId, otp, customerPhone);
      
      if (!isValidOTP) {
        throw new Error('Invalid OTP');
      }

      return {
        success: true,
        message: 'Replacement OTP verified successfully',
        replacementOrderId: replacementOrderId,
        verifiedAt: new Date()
      };
    } catch (error) {
      console.error('Replacement OTP verification error:', error);
      throw error;
    }
  }

  /**
   * Send delivery OTP via SMS
   * @param {string} phone - Customer phone number
   * @param {string} otp - OTP code
   * @param {string} orderId - Order ID
   */
  async sendDeliveryOTPSMS(phone, otp, orderId) {
    try {
      const message = `Your FarmFerry delivery OTP is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes. Order ID: ${orderId}. Do not share this OTP with anyone.`;
      
      await sendSMS(phone, message);
    } catch (error) {
      console.error('SMS sending error:', error);
      throw new Error('Failed to send OTP via SMS');
    }
  }

  /**
   * Send replacement OTP via SMS
   * @param {string} phone - Customer phone number
   * @param {string} otp - OTP code
   * @param {string} replacementOrderId - Replacement order ID
   */
  async sendReplacementOTPSMS(phone, otp, replacementOrderId) {
    try {
      const message = `Your FarmFerry replacement order OTP is: ${otp}. Valid for ${this.otpExpiryMinutes} minutes. Replacement Order ID: ${replacementOrderId}. Do not share this OTP with anyone.`;
      
      await sendSMS(phone, message);
    } catch (error) {
      console.error('SMS sending error:', error);
      throw new Error('Failed to send replacement OTP via SMS');
    }
  }

  /**
   * Send delivery OTP via Email
   * @param {string} email - Customer email
   * @param {string} otp - OTP code
   * @param {string} orderId - Order ID
   */
  async sendDeliveryOTPEmail(email, otp, orderId) {
    try {
      const subject = 'FarmFerry Delivery OTP';
      const html = `
        <h2>Your Delivery OTP</h2>
        <p>Your FarmFerry delivery OTP is: <strong>${otp}</strong></p>
        <p>Order ID: ${orderId}</p>
        <p>This OTP is valid for ${this.otpExpiryMinutes} minutes.</p>
        <p><strong>Do not share this OTP with anyone.</strong></p>
        <p>If you didn't request this OTP, please contact our support team.</p>
      `;
      
      await sendEmail({
        to: email,
        subject: subject,
        html: html
      });
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Failed to send OTP via email');
    }
  }

  /**
   * Send replacement OTP via Email
   * @param {string} email - Customer email
   * @param {string} otp - OTP code
   * @param {string} replacementOrderId - Replacement order ID
   */
  async sendReplacementOTPEmail(email, otp, replacementOrderId) {
    try {
      const subject = 'FarmFerry Replacement Order OTP';
      const html = `
        <h2>Your Replacement Order OTP</h2>
        <p>Your FarmFerry replacement order OTP is: <strong>${otp}</strong></p>
        <p>Replacement Order ID: ${replacementOrderId}</p>
        <p>This OTP is valid for ${this.otpExpiryMinutes} minutes.</p>
        <p><strong>Do not share this OTP with anyone.</strong></p>
        <p>If you didn't request this OTP, please contact our support team.</p>
      `;
      
      await sendEmail({
        to: email,
        subject: subject,
        html: html
      });
    } catch (error) {
      console.error('Email sending error:', error);
      throw new Error('Failed to send replacement OTP via email');
    }
  }

  /**
   * Generate 6-digit OTP
   * @returns {string} 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Validate stored OTP (placeholder for database integration)
   * @param {string} orderId - Order ID
   * @param {string} otp - OTP to validate
   * @param {string} customerPhone - Customer phone number
   * @returns {Promise<boolean>} Validation result
   */
  async validateStoredOTP(orderId, otp, customerPhone) {
    // In real implementation, fetch from database and compare
    // For now, return true for demonstration
    return true;
  }

  /**
   * Validate stored replacement OTP (placeholder for database integration)
   * @param {string} replacementOrderId - Replacement order ID
   * @param {string} otp - OTP to validate
   * @param {string} customerPhone - Customer phone number
   * @returns {Promise<boolean>} Validation result
   */
  async validateStoredReplacementOTP(replacementOrderId, otp, customerPhone) {
    // In real implementation, fetch from database and compare
    // For now, return true for demonstration
    return true;
  }

  /**
   * Resend delivery OTP
   * @param {string} orderId - Order ID
   * @param {string} customerPhone - Customer phone number
   * @param {string} customerEmail - Customer email
   * @returns {Promise<Object>} New OTP data
   */
  async resendDeliveryOTP(orderId, customerPhone, customerEmail) {
    try {
      // Generate new OTP
      const newOtp = this.generateOTP();
      
      // Update verification record (in real implementation, update database)
      const verificationData = {
        orderId: orderId,
        customerPhone: customerPhone,
        customerEmail: customerEmail,
        otp: newOtp,
        otpExpiresAt: new Date(Date.now() + (this.otpExpiryMinutes * 60 * 1000)),
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date()
      };

      // Send new OTP
      if (customerPhone) {
        await this.sendDeliveryOTPSMS(customerPhone, newOtp, orderId);
      }
      
      if (customerEmail) {
        await this.sendDeliveryOTPEmail(customerEmail, newOtp, orderId);
      }

      return {
        ...verificationData,
        message: 'OTP resent successfully'
      };
    } catch (error) {
      console.error('OTP resend error:', error);
      throw new Error('Failed to resend OTP');
    }
  }
}

export default new DeliveryVerificationService(); 