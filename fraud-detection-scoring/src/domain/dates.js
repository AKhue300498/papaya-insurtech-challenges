export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) === '0000')
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function dayNumber(value) {
  return Date.parse(`${value}T00:00:00.000Z`) / 86400000;
}

export function isWeekend(value) {
  return [0, 6].includes(new Date(`${value}T00:00:00.000Z`).getUTCDay());
}
