import { env } from "../../config/env";
import { IHolidayProvider } from "./HolidayProviderAdapter";
import { StubHolidayProvider } from "./StubHolidayProvider";
import { PublicHolidayProvider } from "./PublicHolidayProvider";

export class HolidayProviderFactory {
  public static getProvider(overrideType?: string): IHolidayProvider {
    const providerType = (overrideType || env.HOLIDAY_PROVIDER || "stub").toLowerCase();

    switch (providerType) {
      case "public":
      case "nager":
      case "live":
        return new PublicHolidayProvider();
      case "stub":
      case "mock":
      default:
        return new StubHolidayProvider();
    }
  }
}
