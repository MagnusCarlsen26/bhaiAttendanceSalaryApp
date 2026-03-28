import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import {
  formatDate,
  iterateDateRange,
  countWorkingDays,
  roundToHalfHour,
  getCurrentMonthRange,
  getMonthlyHolidays,
  countPresentDays,
} from '../utils/dateUtils';
import {
  convertCompensation,
  getCycleKey,
  getDueStatusForCycle,
  getLegacyMonthKey,
  getPayrollRatesForCycle,
  getPayoutSummary,
  getRemainingAmount,
  getWeeklyCycleRange,
  getWeeklyDueDatesInMonth,
  getMonthlyCycleRange,
  getMonthlyDueDate,
  normalizePaymentFrequency,
} from '../utils/payroll';

const EMP_KEY = '@attendanceapp:employees';
const RECORD_KEY = '@attendanceapp:records';
const PAYOUT_KEY = '@attendanceapp:payouts';
const memoryStorage = new Map();
let storageAvailable = typeof AsyncStorage?.getItem === 'function' && typeof AsyncStorage?.setItem === 'function';
let storageWarningShown = false;

const defaultRecord = { present: false, extraHours: 0, arrivalTime: null, needsReconfirm: false, markedAbsent: false };
const TEST_EMPLOYEE_PREFIX = 'test-emp-';
const TEST_EMPLOYEE_CONFIGS = [
  { name: 'Aarav', expectedHoursPerDay: 8, monthlyHolidays: 4, monthlySalary: 28000, paymentFrequency: 'monthly' },
  { name: 'Vivaan', expectedHoursPerDay: 9, monthlyHolidays: 4, monthlySalary: 32000, paymentFrequency: 'monthly' },
  { name: 'Aditya', expectedHoursPerDay: 8, monthlyHolidays: 8, monthlySalary: 30000, paymentFrequency: 'monthly' },
  { name: 'Vihaan', expectedHoursPerDay: 10, monthlyHolidays: 4, monthlySalary: 36000, paymentFrequency: 'monthly' },
  { name: 'Arjun', expectedHoursPerDay: 8, monthlyHolidays: 4, monthlySalary: 29000, paymentFrequency: 'monthly' },
  { name: 'Sai', expectedHoursPerDay: 7, monthlyHolidays: 8, monthlySalary: 25000, paymentFrequency: 'monthly' },
  { name: 'Reyansh', expectedHoursPerDay: 9, monthlyHolidays: 4, monthlySalary: 34000, paymentFrequency: 'monthly' },
  { name: 'Krishna', expectedHoursPerDay: 8, monthlyHolidays: 4, monthlySalary: 31000, paymentFrequency: 'monthly' },
  { name: 'Ishaan', expectedHoursPerDay: 8, monthlyHolidays: 8, monthlySalary: 27000, paymentFrequency: 'monthly' },
  { name: 'Kabir', expectedHoursPerDay: 9, monthlyHolidays: 4, monthlySalary: 33000, paymentFrequency: 'monthly' },
];

const AttendanceContext = createContext({});

const generateId = () => `emp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const sortEmployeesByName = (list) =>
  [...list].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' }));

const normalizeEmployee = (employee) => {
  const { nonWorkingDay, nonWorkingDays, workingDaysPerWeek, ...rest } = employee || {};
  const paymentFrequency = normalizePaymentFrequency(employee?.paymentFrequency);
  const explicitCompensationAmount = Number(employee?.compensationAmount);
  const legacyMonthlySalary = Number(employee?.monthlySalary);

  let compensationAmount = Number.isFinite(explicitCompensationAmount) ? explicitCompensationAmount : 0;
  let monthlySalary = Number.isFinite(legacyMonthlySalary) ? legacyMonthlySalary : 0;

  if (!Number.isFinite(explicitCompensationAmount)) {
    compensationAmount =
      paymentFrequency === 'weekly'
        ? convertCompensation(monthlySalary, 'monthly', 'weekly')
        : monthlySalary;
  } else {
    monthlySalary = convertCompensation(compensationAmount, paymentFrequency, 'monthly');
  }

  return {
    ...rest,
    paymentFrequency,
    compensationAmount,
    monthlySalary,
    monthlyHolidays: getMonthlyHolidays(employee),
  };
};

const getAdjustedHoursFromArrival = (employee, arrivalTime) => {
  if (!employee?.shiftStart || !arrivalTime) {
    return 0;
  }

  const shiftStart = dayjs(`2000-01-01 ${employee.shiftStart}`);
  const actualArrival = dayjs(`2000-01-01 ${arrivalTime}`);
  if (!shiftStart.isValid() || !actualArrival.isValid()) {
    return 0;
  }

  return roundToHalfHour((shiftStart.diff(actualArrival, 'minute')) / 60);
};

const warnStorageFallback = (error) => {
  if (storageWarningShown) {
    return;
  }

  storageWarningShown = true;
  console.warn(
    'Persistent storage is unavailable. Attendance data will only be kept for this session. Reinstall the app or rebuild the Expo client with AsyncStorage linked.',
    error
  );
};

const readPersistedItem = async (key) => {
  if (!storageAvailable) {
    return memoryStorage.get(key) ?? null;
  }

  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    storageAvailable = false;
    warnStorageFallback(error);
    return memoryStorage.get(key) ?? null;
  }
};

const writePersistedItem = async (key, value) => {
  memoryStorage.set(key, value);
  if (!storageAvailable) {
    return;
  }

  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    storageAvailable = false;
    warnStorageFallback(error);
  }
};

export const AttendanceProvider = ({ children }) => {
  const [employees, setEmployees] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [payoutRecords, setPayoutRecords] = useState({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [storedEmployees, storedRecords, storedPayouts] = await Promise.all([
        readPersistedItem(EMP_KEY),
        readPersistedItem(RECORD_KEY),
        readPersistedItem(PAYOUT_KEY),
      ]);
      setEmployees(storedEmployees ? sortEmployeesByName(JSON.parse(storedEmployees).map(normalizeEmployee)) : []);
      setAttendanceRecords(storedRecords ? JSON.parse(storedRecords) : {});
      setPayoutRecords(storedPayouts ? JSON.parse(storedPayouts) : {});
    } catch (error) {
      console.warn('Failed to load attendance data', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (loading) {
      return;
    }
    writePersistedItem(EMP_KEY, JSON.stringify(employees));
  }, [employees, loading]);

  useEffect(() => {
    if (loading) {
      return;
    }
    writePersistedItem(RECORD_KEY, JSON.stringify(attendanceRecords));
  }, [attendanceRecords, loading]);

  useEffect(() => {
    if (loading) {
      return;
    }
    writePersistedItem(PAYOUT_KEY, JSON.stringify(payoutRecords));
  }, [payoutRecords, loading]);

  const updateEmployees = (updater) => {
    setEmployees((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return sortEmployeesByName(next);
    });
  };

  const updateRecords = (updater) => {
    setAttendanceRecords((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const updatePayoutRecords = (updater) => {
    setPayoutRecords((prev) => (typeof updater === 'function' ? updater(prev) : updater));
  };

  const addEmployee = (employeeData) => {
    const newEmployee = {
      id: generateId(),
      ...normalizeEmployee(employeeData),
    };
    updateEmployees((prev) => [...prev, newEmployee]);
  };

  const updateEmployee = (employeeId, employeeData) => {
    updateEmployees((prev) =>
      prev.map((employee) =>
        employee.id === employeeId ? normalizeEmployee({ ...employee, ...employeeData, id: employee.id }) : employee
      )
    );
  };

  const clearTestData = useCallback(() => {
    updateEmployees((prev) => prev.filter((employee) => !employee?.isTestData));
    updateRecords((prev) => {
      const next = {};
      Object.entries(prev).forEach(([dateKey, dayRecords]) => {
        const filteredDayRecords = Object.fromEntries(
          Object.entries(dayRecords).filter(([employeeId]) => !employeeId.startsWith(TEST_EMPLOYEE_PREFIX))
        );
        if (Object.keys(filteredDayRecords).length > 0) {
          next[dateKey] = filteredDayRecords;
        }
      });
      return next;
    });
  }, []);

  const seedTestData = useCallback(() => {
    const seededEmployees = TEST_EMPLOYEE_CONFIGS.map((config, index) => ({
      id: `${TEST_EMPLOYEE_PREFIX}${index + 1}`,
      ...normalizeEmployee(config),
      shiftStart: '09:00',
      shiftEnd: '18:00',
      isTestData: true,
    }));

    const startDate = dayjs().subtract(60, 'day').startOf('day');
    const endDate = dayjs().startOf('day');
    const generatedRecords = {};

    iterateDateRange(startDate, endDate, (cursor) => {
      const dateKey = formatDate(cursor);
      const dayRecords = {};

      seededEmployees.forEach((employee, index) => {
        const dayOffset = cursor.diff(startDate, 'day');
        const absencePattern = (dayOffset + index * 3) % 11 === 0;
        const extraPattern = ((dayOffset * 2) + index) % 6;
        const extraHoursLookup = [-1, -0.5, 0, 0.5, 1, 1.5];
        const extraHours = absencePattern ? 0 : extraHoursLookup[extraPattern];

        dayRecords[employee.id] = {
          ...defaultRecord,
          present: !absencePattern,
          markedAbsent: absencePattern,
          extraHours,
        };
      });

      if (Object.keys(dayRecords).length > 0) {
        generatedRecords[dateKey] = dayRecords;
      }
    });

    updateEmployees((prev) => [...prev.filter((employee) => !employee?.isTestData), ...seededEmployees]);
    updateRecords((prev) => {
      const preservedRecords = {};
      Object.entries(prev).forEach(([dateKey, dayRecords]) => {
        const filteredDayRecords = Object.fromEntries(
          Object.entries(dayRecords).filter(([employeeId]) => !employeeId.startsWith(TEST_EMPLOYEE_PREFIX))
        );
        if (Object.keys(filteredDayRecords).length > 0) {
          preservedRecords[dateKey] = filteredDayRecords;
        }
      });

      Object.entries(generatedRecords).forEach(([dateKey, dayRecords]) => {
        preservedRecords[dateKey] = {
          ...(preservedRecords[dateKey] || {}),
          ...dayRecords,
        };
      });

      return preservedRecords;
    });
  }, []);

  const getRecord = (date = formatDate(), employeeId) => {
    const dateKey = formatDate(date);
    const dayRecords = attendanceRecords[dateKey] || {};
    return dayRecords[employeeId]
      ? { ...defaultRecord, ...dayRecords[employeeId] }
      : { ...defaultRecord };
  };

  const setAttendanceRecord = (date, employeeId, patch) => {
    const dateKey = formatDate(date);
    updateRecords((prev) => {
      const dayRecords = prev[dateKey] ? { ...prev[dateKey] } : {};
      const existing = dayRecords[employeeId] ? { ...dayRecords[employeeId] } : { ...defaultRecord };
      const updated = { ...existing, ...patch };
      return { ...prev, [dateKey]: { ...dayRecords, [employeeId]: updated } };
    });
  };

  const ensureRecordsForDate = useCallback(
    (date = formatDate()) => {
      const dateKey = formatDate(date);
      updateRecords((prev) => {
        const dayRecords = prev[dateKey] ? { ...prev[dateKey] } : {};
        let added = false;
        employees.forEach((employee) => {
          if (!dayRecords[employee.id]) {
            dayRecords[employee.id] = { ...defaultRecord };
            added = true;
          }
        });
        if (!added) {
          return prev;
        }
        return { ...prev, [dateKey]: dayRecords };
      });
    },
    [employees]
  );

  const setPresenceStatus = (employeeId, status, date = formatDate()) => {
    if (status === 'present') {
      setAttendanceRecord(date, employeeId, {
        present: true,
        arrivalTime: null,
        needsReconfirm: false,
        markedAbsent: false,
      });
      return;
    }

    if (status === 'absent') {
      setAttendanceRecord(date, employeeId, {
        present: false,
        extraHours: 0,
        arrivalTime: null,
        needsReconfirm: false,
        markedAbsent: true,
      });
      return;
    }

    setAttendanceRecord(date, employeeId, {
      present: false,
      extraHours: 0,
      arrivalTime: null,
      needsReconfirm: false,
      markedAbsent: false,
    });
  };

  const togglePresence = (employeeId, date = formatDate()) => {
    const record = getRecord(date, employeeId);
    setPresenceStatus(employeeId, record.present ? 'unmarked' : 'present', date);
  };

  const setExtraHours = (employeeId, value, date = formatDate()) => {
    const rounded = roundToHalfHour(value);
    const current = getRecord(date, employeeId);
    setAttendanceRecord(date, employeeId, {
      extraHours: rounded,
      arrivalTime: rounded === 0 ? current.arrivalTime : null,
      present: rounded === 0 ? current.present : true,
      needsReconfirm: false,
      markedAbsent: rounded === 0 ? current.markedAbsent : false,
    });
  };

  const setArrivalTime = (employeeId, arrivalTime, date = formatDate()) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    setAttendanceRecord(date, employeeId, {
      arrivalTime,
      extraHours: getAdjustedHoursFromArrival(employee, arrivalTime),
      present: true,
      needsReconfirm: false,
      markedAbsent: false,
    });
  };

  const incrementExtraHours = (employeeId, direction, date = formatDate()) => {
    const current = getRecord(date, employeeId);
    const nextValue = roundToHalfHour(current.extraHours + direction * 0.5);
    setExtraHours(employeeId, nextValue, date);
  };

  const getRecordsInRange = (start, end) => {
    const entries = {};
    iterateDateRange(start, end, (cursor) => {
      const dateKey = formatDate(cursor);
      entries[dateKey] = attendanceRecords[dateKey] || {};
    });
    return entries;
  };

  const getSummaryForEmployee = (employeeId, start, end) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) {
      return { presentDays: 0, extraHours: 0, workingDays: 0 };
    }
    let extraHours = 0;
    iterateDateRange(start, end, (cursor) => {
      const record = getRecord(cursor, employeeId);
      extraHours += record.extraHours || 0;
    });
    const presentDays = countPresentDays(attendanceRecords, employeeId, start, end);
    const workingDays = countWorkingDays(employee, start, end);
    return { presentDays, extraHours, workingDays };
  };

  const getDetailedEntries = (employeeIds, start, end) => {
    const entries = [];
    iterateDateRange(start, end, (cursor) => {
      const dateKey = formatDate(cursor);
      employeeIds.forEach((employeeId) => {
        const employee = employees.find((emp) => emp.id === employeeId);
        if (!employee) {
          return;
        }
        const record = getRecord(dateKey, employeeId);
        if (record.present || record.markedAbsent || record.extraHours !== 0) {
          entries.push({
            employeeId,
            employeeName: employee.name,
            date: dateKey,
            present: record.present,
            extraHours: record.extraHours,
          });
        }
      });
    });
    return entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  };

  const buildMonthAbsenceLedger = useCallback(
    (employeeId, employee, monthDate) => {
      const monthRange = getMonthlyCycleRange(monthDate);
      const ledgerEnd = monthRange.end.isAfter(dayjs(), 'day') ? dayjs().startOf('day') : monthRange.end;
      const chargeableDates = new Set();
      let absentCount = 0;
      const paidLeaveAllowance = getMonthlyHolidays(employee);

      iterateDateRange(monthRange.start, ledgerEnd, (cursor) => {
        const dateKey = formatDate(cursor);
        const isPresent = getRecord(dateKey, employeeId).present;
        if (isPresent) {
          return;
        }

        absentCount += 1;
        if (absentCount > paidLeaveAllowance) {
          chargeableDates.add(dateKey);
        }
      });

      return {
        absentCount,
        chargeableDates,
      };
    },
    [getRecord]
  );

  const getChargeableAbsenceCountInRange = useCallback(
    (employeeId, employee, start, end) => {
      const monthLedgers = new Map();
      let count = 0;

      iterateDateRange(start, end, (cursor) => {
        const monthKey = cursor.format('YYYY-MM');
        if (!monthLedgers.has(monthKey)) {
          monthLedgers.set(monthKey, buildMonthAbsenceLedger(employeeId, employee, cursor));
        }

        if (monthLedgers.get(monthKey).chargeableDates.has(formatDate(cursor))) {
          count += 1;
        }
      });

      return count;
    },
    [buildMonthAbsenceLedger]
  );

  const getSalaryBreakdown = useCallback(
    (employeeId, start, end) => {
      const employee = employees.find((emp) => emp.id === employeeId);
      if (!employee) {
        return null;
      }

      const summary = getSummaryForEmployee(employeeId, start, end);
      const rates = getPayrollRatesForCycle(employee, start, end);
      const hourlyRate = rates.hourlyRate;
      const bonus = summary.extraHours > 0 ? summary.extraHours * hourlyRate : 0;
      const less = summary.extraHours < 0 ? Math.abs(summary.extraHours) * hourlyRate : 0;
      const chargeableAbsentDays = getChargeableAbsenceCountInRange(employeeId, employee, start, end);
      const baseCompensation = rates.baseCompensation;
      const absentDeduction = chargeableAbsentDays * rates.dailyRate;
      const net = Math.max(baseCompensation + bonus - less - absentDeduction, 0);

      return {
        employee,
        presentDays: summary.presentDays,
        workingDays: summary.workingDays,
        monthlyHolidays: getMonthlyHolidays(employee),
        extraHours: summary.extraHours,
        hourlyRate,
        baseCompensation,
        payableDays: rates.payableDays,
        dailyRate: rates.dailyRate,
        chargeableAbsentDays,
        absentDeduction,
        bonus,
        less,
        net,
      };
    },
    [employees, getChargeableAbsenceCountInRange, getSummaryForEmployee]
  );

  const getTotalSalary = useCallback(
    (start, end) =>
      employees.reduce((total, employee) => {
        const breakdown = getSalaryBreakdown(employee.id, start, end);
        return total + (breakdown?.net || 0);
      }, 0),
    [employees, getSalaryBreakdown]
  );

  const getPayoutStatus = useCallback(
    (employeeId, cycleKey, frequency = 'monthly', dueDate = null) => {
      const cycleEntry = payoutRecords?.[cycleKey]?.[employeeId] || null;
      if (cycleEntry) {
        if (Array.isArray(cycleEntry.payments)) {
          return cycleEntry;
        }
        if (cycleEntry.status) {
          return {
            payments: [
              {
                status: cycleEntry.status,
                amount: cycleEntry.amount,
                updatedAt: cycleEntry.updatedAt,
              },
            ],
          };
        }
      }

      if (frequency === 'monthly' && dueDate) {
        const legacyMonthKey = getLegacyMonthKey(dueDate);
        const legacyEntry = payoutRecords?.[legacyMonthKey]?.[employeeId] || null;
        if (legacyEntry) {
          if (Array.isArray(legacyEntry.payments)) {
            return legacyEntry;
          }
          if (legacyEntry.status) {
            return {
              payments: [
                {
                  status: legacyEntry.status,
                  amount: legacyEntry.amount,
                  updatedAt: legacyEntry.updatedAt,
                },
              ],
            };
          }
        }
      }

      return null;
    },
    [payoutRecords]
  );

  const setPayoutStatus = useCallback((employeeId, status, cycleKey, amount = null, frequency = 'monthly', dueDate = null) => {
    updatePayoutRecords((prev) => {
      const next = { ...prev };
      const existingEntry = next?.[cycleKey]?.[employeeId];
      const existingPayments =
        Array.isArray(existingEntry?.payments)
          ? existingEntry.payments
          : existingEntry?.status
            ? [
                {
                  status: existingEntry.status,
                  amount: existingEntry.amount,
                  updatedAt: existingEntry.updatedAt,
                },
              ]
            : [];

      next[cycleKey] = {
        ...(next[cycleKey] || {}),
        [employeeId]: {
          payments: [
            ...existingPayments,
            {
              status,
              amount,
              updatedAt: dayjs().toISOString(),
            },
          ],
        },
      };

      if (frequency === 'monthly' && dueDate) {
        const legacyMonthKey = getLegacyMonthKey(dueDate);
        if (legacyMonthKey !== cycleKey && next[legacyMonthKey]?.[employeeId]) {
          const legacyMonthRecords = { ...next[legacyMonthKey] };
          delete legacyMonthRecords[employeeId];
          if (Object.keys(legacyMonthRecords).length === 0) {
            delete next[legacyMonthKey];
          } else {
            next[legacyMonthKey] = legacyMonthRecords;
          }
        }
      }

      return next;
    });
  }, []);

  const clearPayoutStatus = useCallback((employeeId, cycleKey, frequency = 'monthly', dueDate = null) => {
    updatePayoutRecords((prev) => {
      const next = { ...prev };
      const keysToClear = [cycleKey];

      if (frequency === 'monthly' && dueDate) {
        keysToClear.push(getLegacyMonthKey(dueDate));
      }

      let changed = false;
      keysToClear.forEach((key) => {
        if (!next?.[key]?.[employeeId]) {
          return;
        }

        const cycleEntries = { ...next[key] };
        delete cycleEntries[employeeId];
        if (Object.keys(cycleEntries).length === 0) {
          delete next[key];
        } else {
          next[key] = cycleEntries;
        }
        changed = true;
      });

      return changed ? next : prev;
    });
  }, []);

  const buildPayrollCycle = useCallback(
    (employee, range, dueDate, cycleType) => {
      const breakdown = getSalaryBreakdown(employee.id, range.start, range.end);
      const cycleKey = getCycleKey(employee.paymentFrequency, dueDate);
      const payoutStatus = getPayoutStatus(employee.id, cycleKey, employee.paymentFrequency, dueDate);
      const status = getDueStatusForCycle(breakdown?.net || 0, payoutStatus, dueDate);

      return {
        employee,
        cycleKey,
        cycleType,
        start: range.start,
        end: range.end,
        dueDate,
        breakdown,
        payoutStatus,
        payoutSummary: getPayoutSummary(payoutStatus),
        remainingAmount: getRemainingAmount(breakdown?.net || 0, payoutStatus),
        status,
      };
    },
    [getPayoutStatus, getSalaryBreakdown]
  );

  const getPayCyclesForEmployee = useCallback(
    (employeeId, monthDate = dayjs()) => {
      const employee = employees.find((emp) => emp.id === employeeId);
      if (!employee) {
        return [];
      }

      if (employee.paymentFrequency === 'weekly') {
        return getWeeklyDueDatesInMonth(monthDate).map((dueDate) =>
          buildPayrollCycle(employee, getWeeklyCycleRange(dueDate), dueDate, 'weekly')
        );
      }

      const monthlyRange = getMonthlyCycleRange(monthDate);
      const dueDate = getMonthlyDueDate(monthDate);
      return [buildPayrollCycle(employee, monthlyRange, dueDate, 'monthly')];
    },
    [buildPayrollCycle, employees]
  );

  const getEmployeePaymentStatusForMonth = useCallback(
    (employeeId, monthDate = dayjs()) => {
      const cycles = getPayCyclesForEmployee(employeeId, monthDate);
      if (cycles.length === 0) {
        return { key: 'not_due', label: 'Not due yet', tone: 'neutral', icon: '○' };
      }

      const today = dayjs().startOf('day');
      const dueCycles = cycles.filter((cycle) => !cycle.dueDate.isAfter(today, 'day'));
      if (dueCycles.some((cycle) => cycle.status.key === 'partial')) {
        return { key: 'partial', label: 'Partially paid', tone: 'accent', icon: '◐' };
      }
      if (dueCycles.some((cycle) => cycle.status.key === 'due')) {
        return { key: 'due', label: 'Due', tone: 'absent', icon: '▲' };
      }
      if (dueCycles.length > 0 && dueCycles.every((cycle) => cycle.status.key === 'paid')) {
        return { key: 'paid', label: 'Paid', tone: 'present', icon: '●' };
      }
      return { key: 'not_due', label: 'Not due yet', tone: 'neutral', icon: '○' };
    },
    [getPayCyclesForEmployee]
  );

  const refreshData = useCallback(async () => {
    await loadData();
  }, [loadData]);

  const markAbsent = (employeeId, date = formatDate()) => {
    setAttendanceRecord(date, employeeId, {
      present: false,
      extraHours: 0,
      arrivalTime: null,
      needsReconfirm: false,
      markedAbsent: true,
    });
  };

  const clearAbsence = (employeeId, date = formatDate()) => {
    setAttendanceRecord(date, employeeId, {
      markedAbsent: false,
    });
  };

  const memoizedValue = useMemo(
    () => ({
      employees,
      attendanceRecords,
      loading,
      addEmployee,
      updateEmployee,
      togglePresence,
      incrementExtraHours,
      setExtraHours,
      setArrivalTime,
      setPresenceStatus,
      markAbsent,
      clearAbsence,
      getRecord,
      ensureRecordsForDate,
      getSummaryForEmployee,
      getDetailedEntries,
      getSalaryBreakdown,
      getTotalSalary,
      getPayoutStatus,
      setPayoutStatus,
      clearPayoutStatus,
      getPayCyclesForEmployee,
      getEmployeePaymentStatusForMonth,
      refreshData,
      seedTestData,
      clearTestData,
      getCurrentMonthRange,
    }),
    [
      attendanceRecords,
      clearTestData,
      employees,
      ensureRecordsForDate,
      getEmployeePaymentStatusForMonth,
      getPayCyclesForEmployee,
      getPayoutStatus,
      getSalaryBreakdown,
      getSummaryForEmployee,
      getTotalSalary,
      loading,
      refreshData,
      seedTestData,
    ]
  );

  return <AttendanceContext.Provider value={memoizedValue}>{children}</AttendanceContext.Provider>;
};

export const useAttendance = () => useContext(AttendanceContext);
