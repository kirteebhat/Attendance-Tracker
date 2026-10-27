import { IHolidayProvider, ExternalHoliday } from "./HolidayProviderAdapter";
import { StubHolidayProvider } from "./StubHolidayProvider";
import { logger } from "../../utils/logger";

export class PublicHolidayProvider implements IHolidayProvider {
  public readonly providerName = "PublicHolidayProvider";
  private fallbackProvider = new StubHolidayProvider();

  public async fetchHolidays(year: number, countryCode = "IN"): Promise<ExternalHoliday[]> {
    try {
      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Public Holiday API responded with status ${response.status}`);
      }

      const data = (await response.json()) as Array<{
        date: string;
        localName: string;
        name: string;
        countryCode: string;
        types?: string[];
      }>;

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Empty holiday response from public API");
      }

      return data.map((item) => ({
        date: item.date,
        name: item.name || item.localName,
        localName: item.localName,
        description: `Official public holiday: ${item.name}`,
        countryCode: item.countryCode,
        type: "public-holiday",
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[PublicHolidayProvider] Remote API failed (${msg}). Falling back to stub holidays.`);
      return this.fallbackProvider.fetchHolidays(year, countryCode);
    }
  }
}

