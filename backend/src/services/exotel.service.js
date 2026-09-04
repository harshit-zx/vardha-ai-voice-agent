const axios = require("axios");

const { buildPublicUrl } = require("../config/public-url");

function getEnv(name) {
  return String(process.env[name] || "").trim();
}

function extractXmlValue(xml, tagName) {
  if (!xml || typeof xml !== "string") return "";

  const match = xml.match(
    new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i")
  );

  return match ? match[1].trim() : "";
}

function getExotelFlowUrl() {
  const accountSid = getEnv("EXOTEL_ACCOUNT_SID");
  const flowId = getEnv("EXOTEL_FLOW_ID");

  if (!accountSid) {
    throw new Error("EXOTEL_ACCOUNT_SID is missing");
  }

  if (!flowId) {
    throw new Error("EXOTEL_FLOW_ID is missing");
  }

  // The Exotel flow contains the Voicebot Applet.
  return `http://my.exotel.com/${accountSid}/exoml/start_voice/${flowId}`;
}

function getStatusCallbackUrl() {
  return (
    buildPublicUrl("/api/webhooks/exotel/status") ||
    getEnv("EXOTEL_STATUS_CALLBACK_URL")
  );
}

function extractCallInfo(exotelResponse) {
  if (typeof exotelResponse === "string") {
    return {
      callSid: extractXmlValue(exotelResponse, "Sid"),
      status: extractXmlValue(exotelResponse, "Status") || "queued",
    };
  }

  const call =
    exotelResponse?.call ||
    exotelResponse?.Call ||
    exotelResponse ||
    {};

  return {
    callSid:
      call.sid ||
      call.Sid ||
      call.callsid ||
      call.CallSid ||
      "",
    status: call.status || call.Status || "queued",
  };
}

async function initiateOutboundCall({ phoneNumber, customField }) {
  const accountSid = getEnv("EXOTEL_ACCOUNT_SID");
  const apiKey = getEnv("EXOTEL_API_KEY");
  const apiToken = getEnv("EXOTEL_API_TOKEN");

  const baseUrl = getEnv("EXOTEL_BASE_URL").replace(/\/+$/, "");

  const phoneNumberFrom = getEnv("EXOTEL_PHONE_NUMBER");

  const required = {
    EXOTEL_ACCOUNT_SID: accountSid,
    EXOTEL_API_KEY: apiKey,
    EXOTEL_API_TOKEN: apiToken,
    EXOTEL_BASE_URL: baseUrl,
    EXOTEL_PHONE_NUMBER: phoneNumberFrom,
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value) {
      throw new Error(`${name} is missing`);
    }
  }

  const params = new URLSearchParams();

  params.append("From", phoneNumber);
  params.append("CallerId", phoneNumberFrom);
  params.append("Url", getExotelFlowUrl());

  params.append("CallType", "trans");
  params.append("Record", "true");

  params.append("TimeLimit", "3600");
  params.append("TimeOut", "30");

  if (customField) {
    params.append("CustomField", customField);
  }

  const statusCallbackUrl = getStatusCallbackUrl();

  if (statusCallbackUrl) {
    params.append("StatusCallback", statusCallbackUrl);
  }

  const endpoint =
    `${baseUrl}/v1/Accounts/${accountSid}/Calls/connect`;

  console.log(
    `[EXOTEL] Initiating outbound call to ` +
    `${phoneNumber.slice(0, 5)}******${phoneNumber.slice(-2)}; ` +
    `callback configured: ${Boolean(statusCallbackUrl)}`
  );

  try {
    const response = await axios.post(
      endpoint,
      params.toString(),
      {
        auth: {
          username: apiKey,
          password: apiToken,
        },
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        timeout: 30000,
        validateStatus: () => true,
      }
    );

    console.log(`[EXOTEL] Call API status: ${response.status}`);

    if (response.status < 200 || response.status >= 300) {
      const error = new Error(
        "Exotel rejected the outbound call"
      );

      error.response = response;

      throw error;
    }

    return response.data;
  } catch (error) {
    console.error(
      "[EXOTEL] Call initiation failed:",
      error.response?.status || error.message
    );

    throw error;
  }
}

module.exports = {
  extractCallInfo,
  extractXmlValue,
  getExotelFlowUrl,
  getStatusCallbackUrl,
  initiateOutboundCall,
};