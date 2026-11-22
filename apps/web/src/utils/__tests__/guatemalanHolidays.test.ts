import { describe, expect, it } from 'vitest';
import { getGuatemalanHolidays } from '../guatemalanHolidays';

describe('Guatemalan holidays', () => {
  it('includes the national holidays and half-days from the official 2026 calendar', () => {
    const holidays = getGuatemalanHolidays(2026, 'en');
    expect(holidays.filter(day => ['national', 'half_day'].includes(day.category)).map(day => day.eventDate)).toEqual([
      '2026-01-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-05-01',
      '2026-06-29', '2026-09-15', '2026-10-20', '2026-11-01', '2026-12-24',
      '2026-12-25', '2026-12-31',
    ]);
    expect(holidays.filter(day => day.category === 'half_day')).toEqual([
      expect.objectContaining({ eventDate: '2026-12-24', description: 'Holiday begins at 12 noon.' }),
      expect.objectContaining({ eventDate: '2026-12-31', description: 'Holiday begins at 12 noon.' }),
    ]);
  });

  it.each([
    [2026, '2026-04-05', '2026-03-29', '2026-04-02'],
    [2027, '2027-03-28', '2027-03-21', '2027-03-25'],
    [2028, '2028-04-16', '2028-04-09', '2028-04-13'],
  ])('calculates Holy Week for %s instead of copying last year’s dates', (year, easter, palm, thursday) => {
    const holidays = getGuatemalanHolidays(Number(year), 'en');
    expect(holidays.find(day => day.name === 'Easter Sunday')?.eventDate).toBe(easter);
    expect(holidays.find(day => day.name === 'Palm Sunday')?.eventDate).toBe(palm);
    expect(holidays.find(day => day.name === 'Holy Thursday')?.eventDate).toBe(thursday);
  });

  it.each([
    [2025, '2025-06-30'], // Monday, unchanged.
    [2026, '2026-06-29'], // Tuesday -> preceding Monday.
    [2027, '2027-06-28'], // Wednesday -> preceding Monday.
    [2033, '2033-07-04'], // Thursday -> following Monday.
    [2023, '2023-07-03'], // Friday -> following Monday.
    [2029, '2029-07-02'], // Saturday -> following Monday.
    [2024, '2024-07-01'], // Sunday -> following Monday.
  ])('observes Army Day on the correct Monday in %s', (year, expected) => {
    const army = getGuatemalanHolidays(Number(year), 'en').filter(day => day.name.startsWith('Army Day'));
    expect(army.find(day => day.category === 'national')?.eventDate).toBe(expected);
    expect(army).toHaveLength(Number(year) === 2025 ? 1 : 2);
  });

  it('labels regional holidays and celebrations separately from national days off', () => {
    const holidays = getGuatemalanHolidays(2026, 'en');
    expect(holidays.find(day => day.name === 'Assumption Day')).toMatchObject({
      category: 'regional', eventDate: '2026-08-15', description: 'Local holiday in Guatemala City only.',
    });
    for (const [name, date] of [
      ['Mother’s Day', '2026-05-10'], ['Father’s Day', '2026-06-17'],
      ['Children’s Day', '2026-10-01'], ['All Souls’ Day', '2026-11-02'],
      ['Burning of the Devil', '2026-12-07'],
    ]) expect(holidays.find(day => day.name === name)).toMatchObject({ category: 'observance', eventDate: date });
  });

  it('has unique, repeatable entries with matching English and Spanish dates', () => {
    const english = getGuatemalanHolidays(2027, 'en');
    const spanish = getGuatemalanHolidays(2027, 'es');
    expect(new Set(english.map(day => day.id)).size).toBe(english.length);
    expect(spanish.map(day => [day.id, day.eventDate])).toEqual(english.map(day => [day.id, day.eventDate]));
    expect(spanish.find(day => day.name === 'Día de la Independencia')?.alternateName).toBe('Independence Day');
    expect(getGuatemalanHolidays(2027, 'en')).toEqual(english);
  });
});
