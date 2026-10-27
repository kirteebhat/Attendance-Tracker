import { ISmsProvider } from "./ISmsProvider";
import { SimulatedSmsProvider } from "./SimulatedSmsProvider";
import { RealSmsProvider, RealProviderType } from "./RealSmsProvider";

export * from "./ISmsProvider";
export * from "./SimulatedSmsProvider";
export * from "./RealSmsProvider";

let activeProvider: ISmsProvider | null = null;

/**
 * Returns the singleton SMS provider instance based on environment configuration.
 */
export function getSmsProvider(): ISmsProvider {
  if (activeProvider) {
    return activeProvider;
  }

  const configuredProvider = (process.env.SMS_PROVIDER || "simulated").toLowerCase();

  if (configuredProvider === "msg91" || configuredProvider === "twilio" || configuredProvider === "firebase") {
    activeProvider = new RealSmsProvider({
      providerType: configuredProvider as RealProviderType,
      twilio: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER,
      },
      msg91: {
        authKey: process.env.MSG91_AUTH_KEY,
        senderId: process.env.MSG91_SENDER_ID,
        templateId: process.env.MSG91_TEMPLATE_ID,
      },
    });
  } else {
    activeProvider = new SimulatedSmsProvider();
  }

  return activeProvider;
}

export function setSmsProviderForTesting(provider: ISmsProvider | null): void {
  activeProvider = provider;
}

