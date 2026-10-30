import { t, type Language, type TranslationKey } from '@naru/shared';

export interface GuatemalanHoliday {
  kind: 'holiday';
  id: string;
  eventDate: string;
  name: string;
  alternateName: string;
  category: 'national' | 'observance' | 'regional' | 'half_day';
  description?: string;
}

const dateKey = (date: Date) => date.toISOString().slice(0, 10);
const offsetDate = (date: Date, days: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

// Gregorian Easter (Meeus/Jones/Butcher); use UTC throughout for date-only entries.
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Recurring calendar references, separate from visit-linked event records.
 * Current holiday rules, verified October 2026:
 * https://agn.gt/asuetos-y-feriados-en-guatemala-para-el-2026/
 * Army Day alone moves to Monday (Tue/Wed: preceding; Thu-Sun: following):
 * https://agn.gt/asueto-del-dia-del-ejercito-se-gozara-el-lunes-3-de-julio/
 * Major observances:
 * https://agn.gt/guatemala-celebra-el-dia-de-la-madre/
 * https://agn.gt/dia-del-padre/
 * https://www.congreso.gob.gt/noticias_congreso/17125/2026/4
 * https://conred.gob.gt/nota-de-prensa-no-2116-sistema-conred-mantiene-monitoreos-este-1-y-2-de-noviembre/
 * https://agn.gt/por-que-quemamos-al-diablo-cada-7-de-diciembre/
 */
export function getGuatemalanHolidays(year: number, lang: Language): GuatemalanHoliday[] {
  const holidays: GuatemalanHoliday[] = [];
  const add = (
    key: TranslationKey, date: Date, category: GuatemalanHoliday['category'],
    descriptionKey?: TranslationKey,
  ) => {
    holidays.push({
      kind: 'holiday', id: `${key}-${year}`, eventDate: dateKey(date),
      name: t(key, lang), alternateName: t(key, lang === 'es' ? 'en' : 'es'), category,
      description: descriptionKey ? t(descriptionKey, lang) : undefined,
    });
  };
  const fixed = (month: number, day: number) => new Date(Date.UTC(year, month - 1, day));
  const easter = easterSunday(year);

  add('holidays.new_year', fixed(1, 1), 'national');
  add('holidays.palm_sunday', offsetDate(easter, -7), 'observance');
  add('holidays.holy_thursday', offsetDate(easter, -3), 'national');
  add('holidays.good_friday', offsetDate(easter, -2), 'national');
  add('holidays.holy_saturday', offsetDate(easter, -1), 'national');
  add('holidays.easter', easter, 'observance');
  add('holidays.labour_day', fixed(5, 1), 'national');
  add('holidays.mothers_day', fixed(5, 10), 'observance', 'holidays.mothers_note');
  add('holidays.fathers_day', fixed(6, 17), 'observance');

  const armyDay = fixed(6, 30);
  const weekday = armyDay.getUTCDay();
  const shift = weekday === 1 ? 0 : weekday === 2 || weekday === 3 ? 1 - weekday : (8 - weekday) % 7;
  if (shift === 0) {
    add('holidays.army_day', armyDay, 'national');
  } else {
    add('holidays.army_day', armyDay, 'observance', 'holidays.army_commemoration_note');
    add('holidays.army_day_observed', offsetDate(armyDay, shift), 'national', 'holidays.army_observed_note');
  }

  add('holidays.assumption', fixed(8, 15), 'regional', 'holidays.guatemala_city_note');
  add('holidays.independence', fixed(9, 15), 'national');
  add('holidays.childrens_day', fixed(10, 1), 'observance');
  add('holidays.revolution', fixed(10, 20), 'national');
  add('holidays.all_saints', fixed(11, 1), 'national');
  add('holidays.all_souls', fixed(11, 2), 'observance');
  add('holidays.burning_devil', fixed(12, 7), 'observance');
  add('holidays.christmas_eve', fixed(12, 24), 'half_day', 'holidays.noon_note');
  add('holidays.christmas', fixed(12, 25), 'national');
  add('holidays.new_years_eve', fixed(12, 31), 'half_day', 'holidays.noon_note');

  return holidays.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id));
}

export const normalizeHolidaySearch = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
