import twilio from "twilio";
import Customer from "../models/customer.model.js";
import DeliveryAssociate from "../models/deliveryAssociate.model.js";

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


const sendDeliveryConfirmationToCustomer = async (req, res) => {
  const { phone, customerName, orderId } = req.body;

  if (!phone || !customerName || !orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const body = `Hi ${customerName}, your order (ID: ${orderId}) has been delivered successfully. Thank you for shopping with us!`;

  try {
    const message = await sendSMS(phone, body);

    if (res && res.json) {
      res.json({
        message: "Delivery confirmation SMS sent to customer successfully",
        sid: message.sid
      });
    }

    return message;
  } catch (error) {
    console.error("Error sending delivery confirmation SMS to customer:", error);

    if (res && res.status) {
      res.status(500).json({ message: "Failed to send delivery confirmation SMS" });
    } else {
      throw error;
    }
  }
};

const sendDeliveryCompletionToAssociate = async (req, res) => {
  const { phone, deliveryBoyName, orderId } = req.body;

  if (!phone || !orderId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const body = `Hi ${deliveryBoyName || 'Delivery Associate'}, order ${orderId} has been delivered successfully. Great job!`;

  try {
    const message = await sendSMS(phone, body);
    
    if (res && res.json) {
      res.json({ 
        message: "Delivery completion SMS sent to associate successfully",
        sid: message.sid
      });
    }
    
    return message;
  } catch (error) {
    console.error("Error sending delivery completion SMS to associate:", error);
    
    if (res && res.status) {
      res.status(500).json({ message: "Failed to send delivery completion SMS" });
    } else {
      throw error;
    }
  }
};
/**
 * Send "New Order" SMS to all delivery boys
 * Expects: { phones, orderId } in req.body
 */

const sendNewOrderToDeliveryBoys = async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ message: "Order ID is required" });
  }

  try {
    // 1. Fetch all delivery associates who are active
    const deliveryAssociates = await DeliveryAssociate.find({ isActive: true });

    if (!deliveryAssociates.length) {
      return res.status(404).json({ message: "No active delivery associates found" });
    }

    // 2. Prepare SMS body
    const body = `You have a new order. Order ID: ${orderId}`;

    // 3. Send SMS to each delivery associate who has a phone number
    const results = await Promise.allSettled(
      deliveryAssociates.map((da) => {
        if (da.phone) {
          return sendSMS(da.phone, body);
        }
        return Promise.resolve(null); // skip if no phone
      })
    );

    // 4. Summarize results
    const successCount = results.filter(r => r.status === "fulfilled").length;
    const failCount = results.filter(r => r.status === "rejected").length;

    res.json({
      message: `New order SMS sent to ${successCount} delivery associates`,
      failed: failCount
    });
  } catch (error) {
    console.error("❌ Error sending new order SMS to delivery associates:", error);
    res.status(500).json({ message: "Failed to send SMS to delivery associates" });
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
  sendOTP,
  sendNewOrderToDeliveryBoys,
  sendDeliveryCompletionToAssociate,
  sendDeliveryConfirmationToCustomer
};