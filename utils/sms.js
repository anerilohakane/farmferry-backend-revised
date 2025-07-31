import twilio from "twilio";
import Customer from "../models/customer.model.js"; 

// Directly include Twilio credentials
const accountSid = "ACee11f24af15a69d2b10e7ef14950bdec";
const authToken = "e1e9f79da17338f367d851caa95e872c";
const twilioPhoneNumber = "+17753490755";

const client = twilio(accountSid, authToken);

/**
 * Format phone number to international format for Twilio
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
const formatPhoneNumber = (phone) => {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it's a 10-digit Indian number, add +91
  if (cleaned.length === 10 && cleaned.startsWith('9') || cleaned.startsWith('8') || cleaned.startsWith('7') || cleaned.startsWith('6')) {
    return `+91${cleaned}`;
  }
  
  // If it already has a country code, just add + if missing
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  
  // If it's already in international format, return as is
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // Default: assume it's an Indian number and add +91
  return `+91${cleaned}`;
};

/**
 * Standalone SMS sending function for use by other services
 */
const sendSMS = async (to, body) => {
  try {
    // Format phone number to international format
    const formattedPhone = formatPhoneNumber(to);
    console.log(`📱 Twilio: Original phone: ${to}, Formatted: ${formattedPhone}`);
    console.log(`📱 Twilio: Message body: ${body}`);
    
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to: formattedPhone,
    });
    
    console.log(`✅ Twilio: SMS sent successfully to ${formattedPhone}`);
    console.log(`✅ Twilio: Message SID: ${message.sid}`);
    
    return message;
  } catch (error) {
    console.error("❌ Twilio Error:", error);
    console.error("❌ Twilio Error Code:", error.code);
    console.error("❌ Twilio Error Message:", error.message);
    console.error("❌ Twilio Error Details:", {
      originalTo: to,
      formattedTo: formatPhoneNumber(to),
      from: twilioPhoneNumber,
      bodyLength: body.length
    });
    throw new Error(`Twilio SMS failed: ${error.message}`);
  }
};

/**
 * Send Order Confirmation SMS to customer
 * Expects: { phone, customerName, orderId } in req.body
 */
const sendOrderSMS = async (req, res) => {
  const { phone, customerName, orderId } = req.body;

  if (!phone || !customerName || !orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const body = `Hi ${customerName}, your order (ID: ${orderId}) has been placed successfully. Thank you!`;

  try {
    const formattedPhone = formatPhoneNumber(phone);
    await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to: formattedPhone,
    });

    res.json({ message: "Order confirmation SMS sent successfully" });
  } catch (error) {
    console.error("Error sending order confirmation SMS:", error);
    res.status(500).json({ message: "Failed to send SMS" });
  }
};

/**
 * Send OTP to customer for delivery confirmation
 * Expects: { phone } in req.body
 */
const sendOTP = async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ message: "Phone number is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Save or update OTP in database
    await Customer.findOneAndUpdate(
      { phone },
      {
        phone,
        otp,
        otpExpiry: new Date(Date.now() + 5 * 60 * 1000), // expires in 5 mins
      },
      { upsert: true, new: true }
    );

    // Send OTP via SMS
    const formattedPhone = formatPhoneNumber(phone);
    await client.messages.create({
      body: `Your delivery confirmation OTP is: ${otp}`,
      from: twilioPhoneNumber,
      to: formattedPhone,
    });

    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

export default {
  sendSMS,
  sendOrderSMS,
  sendOTP
};