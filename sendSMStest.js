import twilio from "twilio";

const accountSid = "ACa2858a3a61682e38e2812a202182aa6f";
const authToken = "39ca9e22761e29bd84c665655535bfe6";
const fromNumber = "+15075169669"; // e.g. +16824705397
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
