import twilio from "twilio";
import Customer from "../models/customer.model.js"; 

// Directly include Twilio credentials
const accountSid = "ACee11f24af15a69d2b10e7ef14950bdec";
const authToken = "e1e9f79da17338f367d851caa95e872c";
const twilioPhoneNumber = "+17753490755";

const client = twilio(accountSid, authToken);

/**
 * Standalone SMS sending function for use by other services
 */
const sendSMS = async (to, body) => {
  try {
    console.log(`📱 Twilio: Attempting to send SMS to ${to}`);
    console.log(`📱 Twilio: Message body: ${body}`);
    
    const message = await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    });
    
    console.log(`✅ Twilio: SMS sent successfully to ${to}`);
    console.log(`✅ Twilio: Message SID: ${message.sid}`);
    
    return message;
  } catch (error) {
    console.error("❌ Twilio Error:", error);
    console.error("❌ Twilio Error Code:", error.code);
    console.error("❌ Twilio Error Message:", error.message);
    console.error("❌ Twilio Error Details:", {
      to,
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
    await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to: phone,
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
    await client.messages.create({
      body: `Your delivery confirmation OTP is: ${otp}`,
      from: twilioPhoneNumber,
      to: phone,
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