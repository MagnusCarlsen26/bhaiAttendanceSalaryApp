import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { formatDate, iterateDateRange, countWorkingDays, isWorkingDay, computeHourlyRate, roundToHalfHour, getCurrentMonthRange } from '../utils/dateUtils';

const EMP_KEY = '@attendanceapp:employees';
const RECORD_KEY = '@attendanceapp:records';
const PAYOUT_KEY = '@attendanceapp:payouts';
const memoryStorage = new Map();
let storageAvailable = typeof AsyncStorage?.getItem === 'function' && typeof AsyncStorage?.setItem === 'function';
let storageWarningShown = false;

const defaultRecord = { present: false, extraHours: 0, arrivalTime: null, needsReconfirm: false, markedAbsent: false };
const TEST_EMPLOYEE_PREFIX = 'test-emp-';
const TEST_EMPLOYEE_CONFIGS = [
  { name: 'Aarav', expectedHoursPerDay: 8, workingDaysPerWeek: 6, nonWorkingDays: ['Sunday'], monthlySalary: 28000 },
  { name: 'Vivaan', expectedHoursPerDay: 9, workingDaysPerWeek: 6, nonWorkingDays: ['Sunday'], monthlySalary: 32000 },
  { name: 'Aditya', expectedHoursPerDay: 8, workingDaysPerWeek: 5, nonWorkingDays: ['Saturday', 'Sunday'], monthlySalary: 30000 },
  { name: 'Vihaan', expectedHoursPerDay: 10, workingDaysPerWeek: 6, nonWorkingDays: ['Sunday'], monthlySalary: 36000 },
  { name: 'Arjun', expectedHoursPerDay: 8, workingDaysPerWeek: 6, nonWorkingDays: ['Sunday'], monthlySalary: 29000 },
  { name: 'Sai', expectedHoursPerDay: 7, workingDaysPerWeek: 5, nonWorkingDays: ['Saturday', 'Sunday'], monthlySalary: 25000 },
  { name: 'Reyansh', expectedHoursPerDay: 9, workingDaysPerWeek: 6, nonWorkingDays: ['Sunday'], monthlySalary: 34000 },
  { name: 'Krishna', expectedHoursPerDay: 8, workingDaysPerWeek: 6, nonWorkingDays: ['Sunday'], monthlySalary: 31000 },
  { name: 'Ishaan', expectedHoursPerDay: 8, workingDaysPerWeek: 5, nonWorkingDays: ['Saturday', 'Sunday'], monthlySalary: 27000 },
  { name: 'Kabir', expectedHoursPerDay: 9, workingDaysPerWeek: 6, nonWorkingDays: ['Sunday'], monthlySalary: 33000 },
];

const AttendanceContext = createContext({});

const generateId = () => `emp-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const sortEmployeesByName = (list) =>
  [...list].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', undefined, { sensitivity: 'base' }));
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
      setEmployees(storedEmployees ? sortEmployeesByName(JSON.parse(storedEmployees)) : []);
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
      ...employeeData,
    };
    updateEmployees((prev) => [...prev, newEmployee]);
  };

  const updateEmployee = (employeeId, employeeData) => {
    updateEmployees((prev) =>
      prev.map((employee) => (employee.id === employeeId ? { ...employee, ...employeeData, id: employee.id } : employee))
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
      ...config,
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
        if (!isWorkingDay(employee, cursor)) {
          return;
        }

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
    let presentDays = 0;
    let extraHours = 0;
    iterateDateRange(start, end, (cursor) => {
      if (!isWorkingDay(employee, cursor)) {
        return;
      }
      const record = getRecord(cursor, employeeId);
      if (record.present) {
        presentDays += 1;
      }
      extraHours += record.extraHours || 0;
    });
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
        if (!isWorkingDay(employee, cursor)) {
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

  const getSalaryBreakdown = (employeeId, start, end) => {
    const employee = employees.find((emp) => emp.id === employeeId);
    if (!employee) {
      return null;
    }
    const summary = getSummaryForEmployee(employeeId, start, end);
    let extraHours = 0;
    iterateDateRange(start, end, (cursor) => {
      if (!isWorkingDay(employee, cursor)) {
        return;
      }
      const record = getRecord(cursor, employeeId);
      extraHours += record.extraHours || 0;
    });
    const hourlyRate = computeHourlyRate(employee);
    const bonus = extraHours > 0 ? extraHours * hourlyRate : 0;
    const less = extraHours < 0 ? Math.abs(extraHours) * hourlyRate : 0;
    const perDaySalary = (Number(employee.monthlySalary) || 0) / 30;
    const earnedBase = Math.min(summary.presentDays * perDaySalary, Number(employee.monthlySalary) || 0);
    const absentDeduction = Math.max((Number(employee.monthlySalary) || 0) - earnedBase, 0);
    const net = Math.max(earnedBase + bonus - less, 0);
    return {
      employee,
      presentDays: summary.presentDays,
      workingDays: summary.workingDays,
      extraHours,
      hourlyRate,
      earnedBase,
      absentDeduction,
      bonus,
      less,
      net,
    };
  };

  const getTotalSalary = (start, end) => {
    return employees.reduce((total, employee) => {
      const breakdown = getSalaryBreakdown(employee.id, start, end);
      return total + (breakdown?.net || 0);
    }, 0);
  };

  const getPayoutMonthKey = (date = formatDate()) => dayjs(date).format('YYYY-MM');

  const getPayoutStatus = (employeeId, date = formatDate()) => {
    const monthKey = getPayoutMonthKey(date);
    const entry = payoutRecords?.[monthKey]?.[employeeId] || null;
    if (!entry) {
      return null;
    }
    if (Array.isArray(entry.payments)) {
      return entry;
    }
    if (entry.status) {
      return {
        payments: [
          {
            status: entry.status,
            amount: entry.amount,
            updatedAt: entry.updatedAt,
          },
        ],
      };
    }
    return null;
  };

  const setPayoutStatus = (employeeId, status, date = formatDate(), amount = null) => {
    const monthKey = getPayoutMonthKey(date);
    updatePayoutRecords((prev) => {
      const monthRecords = prev[monthKey] ? { ...prev[monthKey] } : {};
      const existingEntry = monthRecords[employeeId];
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
      monthRecords[employeeId] = {
        payments: [
          ...existingPayments,
          {
            status,
            amount,
            updatedAt: dayjs().toISOString(),
          },
        ],
      };
      return {
        ...prev,
        [monthKey]: monthRecords,
      };
    });
  };

  const clearPayoutStatus = (employeeId, date = formatDate()) => {
    const monthKey = getPayoutMonthKey(date);
    updatePayoutRecords((prev) => {
      if (!prev?.[monthKey]?.[employeeId]) {
        return prev;
      }
      const monthRecords = { ...prev[monthKey] };
      delete monthRecords[employeeId];
      if (Object.keys(monthRecords).length === 0) {
        const next = { ...prev };
        delete next[monthKey];
        return next;
      }
      return {
        ...prev,
        [monthKey]: monthRecords,
      };
    });
  };

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
      refreshData,
      seedTestData,
      clearTestData,
      getCurrentMonthRange,
    }),
    [employees, attendanceRecords, payoutRecords, loading, ensureRecordsForDate, refreshData, clearTestData, seedTestData]
  );

  return <AttendanceContext.Provider value={memoizedValue}>{children}</AttendanceContext.Provider>;
};

export const useAttendance = () => useContext(AttendanceContext);
