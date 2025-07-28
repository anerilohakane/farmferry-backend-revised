import twilio from "twilio";

// Directly include Twilio credentials
const accountSid = "AC945a6e4f2f39e5838587441d5550592d";
const authToken = "2c35af9a14da67f7dfc58cd04575404f";
const twilioPhoneNumber = "+17622043940";

const client = twilio(accountSid, authToken);

const sendSMS = async (to, body) => {
  try {
    await client.messages.create({
      body,
      from: twilioPhoneNumber,
      to,
    });
  } catch (error) {
    console.error("Error sending SMS:", error);
    // Do not throw or propagate error
    return;
  }
};

export default sendSMS;