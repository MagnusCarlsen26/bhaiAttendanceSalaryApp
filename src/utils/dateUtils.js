import dayjs from 'dayjs';

export const formatDate = (value = dayjs()) => dayjs(value).format('YYYY-MM-DD');

export const getDayName = (value) => dayjs(value).format('dddd');

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

export const isWorkingDay = (employee, date) => {
  if (!employee) {
    return true;
  }
  if (employee.workingDaysPerWeek >= 7) {
    return true;
  }
  const configuredNonWorkingDays = Array.isArray(employee.nonWorkingDays)
    ? employee.nonWorkingDays
    : employee.nonWorkingDay
    ? [employee.nonWorkingDay]
    : [];
  if (configuredNonWorkingDays.length === 0) {
    return true;
  }
  return !configuredNonWorkingDays.includes(getDayName(date));
};

export const countWorkingDays = (employee, startDate, endDate) => {
  let count = 0;
  iterateDateRange(startDate, endDate, (cursor) => {
    if (isWorkingDay(employee, cursor)) {
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
