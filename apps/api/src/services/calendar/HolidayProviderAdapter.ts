export interface ExternalHoliday {
  date: string; // YYYY-MM-DD
  name: string;
  localName?: string;
  description?: string;
  countryCode?: string;
  type?: string;
}

export interface IHolidayProvider {
  readonly providerName: string;
  fetchHolidays(year: number, countryCode?: string): Promise<ExternalHoliday[]>;
}
