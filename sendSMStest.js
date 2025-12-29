import twilio from "twilio";

const accountSid = "AC185367e43d7ec6d32b8b7aa7ba16ee5e";
const authToken = "bc0d1b1632534afdba15a721f1e1bd6a";
const fromNumber = "+12272309426"; // e.g. +16824705397
const toNumber = "+919322506730"; // your phone number in E.164 format (+91XXXXXXXXXX)

const client = twilio(accountSid, authToken);

(async () => {
  try {
    const message = await client.messages.create({
      body: "✅ Test message from Twilio (FarmFerry)",
      from: fromNumber,
      to: toNumber,
    });

    console.log("✅ SMS sent successfully!");
    console.log("SID:", message.sid);
  } catch (error) {
    console.error("❌ SMS failed:", error);
  }
})();
