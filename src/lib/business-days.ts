// Cálculo de dias úteis no Brasil, excluindo finais de semana e feriados nacionais.

function easterSunday(year: number): Date {
  // Algoritmo de Meeus/Jones/Butcher
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
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysUTC(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getBrazilianHolidays(year: number): Set<string> {
  const easter = easterSunday(year);
  const carnavalSeg = addDaysUTC(easter, -48);
  const carnavalTer = addDaysUTC(easter, -47);
  const sextaSanta = addDaysUTC(easter, -2);
  const corpusChristi = addDaysUTC(easter, 60);
  const fixed = [
    [0, 1],   // Confraternização Universal
    [3, 21],  // Tiradentes
    [4, 1],   // Dia do Trabalho
    [8, 7],   // Independência
    [9, 12],  // Nossa Senhora Aparecida
    [10, 2],  // Finados
    [10, 15], // Proclamação da República
    [10, 20], // Consciência Negra (feriado nacional desde 2024)
    [11, 25], // Natal
  ];
  const set = new Set<string>();
  for (const [m, d] of fixed) set.add(ymd(new Date(Date.UTC(year, m, d))));
  for (const d of [carnavalSeg, carnavalTer, sextaSanta, corpusChristi]) set.add(ymd(d));
  return set;
}

export function addBusinessDays(startISO: string, businessDays: number): string {
  if (!startISO) return "";
  const [y, m, d] = startISO.split("-").map(Number);
  let cur = new Date(Date.UTC(y, m - 1, d));
  const holidaysByYear = new Map<number, Set<string>>();
  let added = 0;
  while (added < businessDays) {
    cur = addDaysUTC(cur, 1);
    const dow = cur.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const yr = cur.getUTCFullYear();
    if (!holidaysByYear.has(yr)) holidaysByYear.set(yr, getBrazilianHolidays(yr));
    if (holidaysByYear.get(yr)!.has(ymd(cur))) continue;
    added++;
  }
  return ymd(cur);
}
