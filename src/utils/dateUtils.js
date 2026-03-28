import dayjs from 'dayjs';

export const formatDate = (value = dayjs()) => dayjs(value).format('YYYY-MM-DD');

const getOrdinal = (day) => {
  const remainder = day % 10;
  const remainderHundred = day % 100;

  if (remainder === 1 && remainderHundred !== 11) {
    return 'st';
  }
  if (remainder === 2 && remainderHundred !== 12) {
    return 'nd';
  }
  if (remainder === 3 && remainderHundred !== 13) {
    return 'rd';
  }
  return 'th';
};

export const formatHeaderDate = (value = dayjs()) => {
  const date = dayjs(value);
  const dayOfMonth = date.date();
  return `${dayOfMonth}${getOrdinal(dayOfMonth)} ${date.format('MMMM, dddd')}`;
};

export const iterateDateRange = (startDate, endDate, callback) => {
  let cursor = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  while (!cursor.isAfter(end, 'day')) {
    callback(cursor);
    cursor = cursor.add(1, 'day');
  }
};

export const getCurrentMonthRange = () => {
  const today = dayjs();
  return {
    start: today.startOf('month'),
    end: today.endOf('month'),
  };
};

export const getMonthlyHolidays = (employee) => {
  const explicitMonthlyHolidays = Number(employee?.monthlyHolidays);
  if (Number.isFinite(explicitMonthlyHolidays)) {
    return Math.min(30, Math.max(0, Math.floor(explicitMonthlyHolidays)));
  }

  const weeklyDaysOff = Number.isFinite(Number(employee?.workingDaysPerWeek))
    ? Math.max(0, 7 - Math.min(7, Math.floor(Number(employee.workingDaysPerWeek))))
    : Array.isArray(employee?.nonWorkingDays)
      ? employee.nonWorkingDays.length
      : employee?.nonWorkingDay
        ? 1
        : 0;

  return Math.min(30, Math.max(0, weeklyDaysOff * 4));
};

export const countWorkingDays = (employee, startDate, endDate) => {
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  const totalDays = end.diff(start, 'day') + 1;
  return Math.max(totalDays - getMonthlyHolidays(employee), 0);
};

export const getPayrollBaseDays = (employee) => Math.max(30 - getMonthlyHolidays(employee), 0);

export const countPresentDays = (records = {}, employeeId, startDate, endDate) => {
  let count = 0;
  iterateDateRange(startDate, endDate, (cursor) => {
    const dateKey = formatDate(cursor);
    if (records?.[dateKey]?.[employeeId]?.present) {
      count += 1;
    }
  });
  return count;
};

export const computeHourlyRate = (employee) => {
  if (!employee) {
    return 0;
  }
  const { expectedHoursPerDay } = employee;
  if (!expectedHoursPerDay) {
    return 0;
  }
  const dailySalary = (Number(employee.monthlySalary) || 0) / 30;
  return dailySalary / expectedHoursPerDay;
};

export const roundToHalfHour = (value) => Math.round(value * 2) / 2;
