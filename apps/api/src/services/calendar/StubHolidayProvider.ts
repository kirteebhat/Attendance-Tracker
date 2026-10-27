import { IHolidayProvider, ExternalHoliday } from "./HolidayProviderAdapter";

export class StubHolidayProvider implements IHolidayProvider {
  public readonly providerName = "StubHolidayProvider";

  public async fetchHolidays(year: number, countryCode = "IN"): Promise<ExternalHoliday[]> {
    const y = String(year);

    if (countryCode.toUpperCase() === "IN") {
      return [
        {
          date: `${y}-01-01`,
          name: "New Year's Day",
          description: "Global calendar first day",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-01-26`,
          name: "Republic Day",
          description: "National Holiday commemorating the Constitution of India",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-03-25`,
          name: "Holi (Festival of Colours)",
          description: "Spring festival of colours and joy",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-04-14`,
          name: "Dr. B.R. Ambedkar Jayanti",
          description: "Birth anniversary of the father of the Constitution",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-05-01`,
          name: "International Workers' Day",
          description: "Labour Day",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-08-15`,
          name: "Independence Day",
          description: "National Holiday commemorating freedom",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-10-02`,
          name: "Mahatma Gandhi Jayanti",
          description: "National Holiday honouring Mahatma Gandhi",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-10-24`,
          name: "Dussehra (Vijayadashami)",
          description: "Victory of good over evil",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-11-01`,
          name: "Diwali (Deepavali)",
          description: "Festival of Lights",
          countryCode: "IN",
          type: "public-holiday",
        },
        {
          date: `${y}-12-25`,
          name: "Christmas Day",
          description: "Celebration of the Nativity",
          countryCode: "IN",
          type: "public-holiday",
        },
      ];
    }

    // Default global holidays
    return [
      {
        date: `${y}-01-01`,
        name: "New Year's Day",
        countryCode,
        type: "public-holiday",
      },
      {
        date: `${y}-05-01`,
        name: "Labour Day",
        countryCode,
        type: "public-holiday",
      },
      {
        date: `${y}-12-25`,
        name: "Christmas Day",
        countryCode,
        type: "public-holiday",
      },
    ];
  }
}

