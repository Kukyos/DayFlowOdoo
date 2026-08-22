/**
 * Public holidays, shown on the Time Off calendar for context.
 *
 * There is no `holidays` table — docs/SCHEMA.md lists holidays as explicitly
 * out of scope for this build. This is a small static client-side list, not a
 * service call, and it does not pretend to be one: nothing here is fetched,
 * nothing is company-specific, and it is never used to gate or calculate
 * anything (payable days, leave balances). It is decoration on the calendar,
 * the same way a wall calendar prints holidays without knowing your employer.
 *
 * Covers 2025–2027 so the calendar's year stepper always has something to
 * show. Add a year here when it's needed further out.
 */

export type Holiday = { date: string; name: string }

const HOLIDAYS_BY_YEAR: Record<number, Holiday[]> = {
  2025: [
    { date: '2025-01-14', name: 'Makar Sankranti' },
    { date: '2025-01-26', name: 'Republic Day' },
    { date: '2025-03-14', name: 'Holi' },
    { date: '2025-08-15', name: 'Independence Day' },
    { date: '2025-08-09', name: 'Raksha Bandhan' },
    { date: '2025-10-02', name: 'Gandhi Jayanti' },
    { date: '2025-10-20', name: 'Diwali' },
    { date: '2025-10-22', name: 'Bhai Dooj' },
  ],
  2026: [
    { date: '2026-01-14', name: 'Makar Sankranti / Kite Festival' },
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-03-04', name: 'Holi' },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-08-28', name: 'Raksha Bandhan' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-11-08', name: 'Diwali' },
    { date: '2026-11-10', name: 'Govardhan Puja' },
    { date: '2026-11-11', name: 'Bhai Dooj' },
  ],
  2027: [
    { date: '2027-01-14', name: 'Makar Sankranti' },
    { date: '2027-01-26', name: 'Republic Day' },
    { date: '2027-03-23', name: 'Holi' },
    { date: '2027-08-15', name: 'Independence Day' },
    { date: '2027-08-17', name: 'Raksha Bandhan' },
    { date: '2027-10-02', name: 'Gandhi Jayanti' },
    { date: '2027-10-29', name: 'Diwali' },
    { date: '2027-10-31', name: 'Bhai Dooj' },
  ],
}

export const holidaysForYear = (year: number): Holiday[] => HOLIDAYS_BY_YEAR[year] ?? []

export const holidayOn = (year: number, iso: string): Holiday | undefined =>
  holidaysForYear(year).find((h) => h.date === iso)
