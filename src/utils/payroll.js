import dayjs from 'dayjs';
import { iterateDateRange } from './dateUtils';

export const PAYMENT_FREQUENCIES = ['weekly', 'monthly'];

export const normalizePaymentFrequency = (value) => {
  if (value === 'fortnightly') {
    return 'weekly';
  }
  return PAYMENT_FREQUENCIES.includes(value) ? value : 'monthly';
};

const toNumber = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const roundCurrency = (value) => Math.round(toNumber(value) * 100) / 100;

export const convertCompensation = (amount, fromFrequency, toFrequency) => {
  const numericAmount = toNumber(amount);
  if (fromFrequency === toFrequency) {
    return roundCurrency(numericAmount);
  }

  if (fromFrequency === 'monthly' && toFrequency === 'weekly') {
    return roundCurrency((numericAmount * 12) / 52);
  }

  if (fromFrequency === 'weekly' && toFrequency === 'monthly') {
    return roundCurrency((numericAmount * 52) / 12);
  }

  return roundCurrency(numericAmount);
};

export const getCompensationLabel = (frequency) => (frequency === 'weekly' ? 'Weekly salary' : 'Monthly salary');

export const getCycleCompensationLabel = (frequency) => (frequency === 'weekly' ? 'Weekly payout' : 'Monthly payout');

export const getCycleBaseCompensation = (employee) =>
  employee?.paymentFrequency === 'weekly'
    ? toNumber(employee?.compensationAmount)
    : toNumber(employee?.compensationAmount ?? employee?.monthlySalary);

export const getCycleLengthInDays = (startDate, endDate) =>
  Math.max(dayjs(endDate).startOf('day').diff(dayjs(startDate).startOf('day'), 'day') + 1, 0);

export const getPayrollRatesForCycle = (employee, startDate, endDate) => {
  const baseCompensation = getCycleBaseCompensation(employee);
  const cycleDays = getCycleLengthInDays(startDate, endDate);
  const payableDays = employee?.paymentFrequency === 'weekly' ? cycleDays : 30;
  const dailyRate = payableDays > 0 ? baseCompensation / payableDays : 0;
  const expectedHoursPerDay = toNumber(employee?.expectedHoursPerDay);
  const hourlyRate = expectedHoursPerDay > 0 ? dailyRate / expectedHoursPerDay : 0;

  return {
    baseCompensation,
    payableDays,
    dailyRate,
    hourlyRate,
  };
};

export const getWeekStartMonday = (value) => {
  const date = dayjs(value).startOf('day');
  const daysFromMonday = (date.day() + 6) % 7;
  return date.subtract(daysFromMonday, 'day');
};

export const getWeekEndSunday = (value) => getWeekStartMonday(value).add(6, 'day');

export const getWeeklyCycleRange = (dueDate) => {
  const cycleEnd = dayjs(dueDate).startOf('day').subtract(1, 'day');
  const cycleStart = getWeekStartMonday(cycleEnd);
  return {
    start: cycleStart,
    end: cycleStart.add(6, 'day'),
  };
};

export const getMonthlyCycleRange = (value) => {
  const date = dayjs(value);
  return {
    start: date.startOf('month'),
    end: date.endOf('month'),
  };
};

export const getMonthlyDueDate = (value) => dayjs(value).endOf('month').startOf('day');

export const getWeeklyDueDatesInMonth = (value) => {
  const { start, end } = getMonthlyCycleRange(value);
  const dueDates = [];

  iterateDateRange(start, end, (cursor) => {
    if (cursor.day() === 1) {
      dueDates.push(cursor.startOf('day'));
    }
  });

  return dueDates;
};

export const getCycleKey = (frequency, dueDate) =>
  frequency === 'weekly'
    ? `weekly:${dayjs(dueDate).format('YYYY-MM-DD')}`
    : `monthly:${dayjs(dueDate).format('YYYY-MM')}`;

export const getLegacyMonthKey = (value) => dayjs(value).format('YYYY-MM');

export const getPayoutSummary = (payoutStatus) => {
  const payments = Array.isArray(payoutStatus?.payments) ? payoutStatus.payments : [];
  if (payments.length === 0) {
    return null;
  }

  const totalPaid = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const salaryPaid = payments
    .filter((payment) => payment.status === 'salary_paid')
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const advancePaid = payments
    .filter((payment) => payment.status === 'advance_paid')
    .reduce((sum, payment) => sum + toNumber(payment.amount), 0);

  return {
    payments,
    totalPaid: roundCurrency(totalPaid),
    salaryPaid: roundCurrency(salaryPaid),
    advancePaid: roundCurrency(advancePaid),
    latestPaidAt: payments[payments.length - 1]?.updatedAt || null,
  };
};

export const getRemainingAmount = (netAmount, payoutStatus) => {
  const payoutSummary = getPayoutSummary(payoutStatus);
  return Math.max(roundCurrency(toNumber(netAmount) - (payoutSummary?.totalPaid || 0)), 0);
};

export const getDueStatusForCycle = (netAmount, payoutStatus, dueDate, referenceDate = dayjs()) => {
  const remainingAmount = getRemainingAmount(netAmount, payoutStatus);
  const payoutSummary = getPayoutSummary(payoutStatus);
  const paidAmount = payoutSummary?.totalPaid || 0;
  const isDue = !dayjs(dueDate).startOf('day').isAfter(dayjs(referenceDate).startOf('day'), 'day');

  if (remainingAmount <= 0) {
    return { key: 'paid', label: 'Paid', tone: 'present', icon: '●' };
  }

  if (paidAmount > 0) {
    return { key: 'partial', label: 'Partially paid', tone: 'accent', icon: '◐' };
  }

  if (isDue) {
    return { key: 'due', label: 'Due', tone: 'absent', icon: '▲' };
  }

  return { key: 'not_due', label: 'Not due yet', tone: 'neutral', icon: '○' };
};
