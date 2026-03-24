import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import { useNavigation } from '@react-navigation/native';
import { useAttendance } from '../context/AttendanceContext';
import { formatDate, isWorkingDay } from '../utils/dateUtils';
import { formatHours } from '../utils/formatters';
import Screen from '../components/ui/Screen';
import SectionCard from '../components/ui/SectionCard';
import EmptyState from '../components/ui/EmptyState';
import MetricPill from '../components/ui/MetricPill';
import { colors, radius } from '../theme/tokens';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatCalendarHours = (value) => formatHours(value).replace(/h$/, '');

const buildMonthCells = (employee, monthStart, monthEnd, getRecord) => {
  const calendarStart = monthStart.startOf('week');
  const calendarEnd = monthEnd.endOf('week');
  const weeks = [];
  let currentWeek = [];
  let cursor = calendarStart;

  while (!cursor.isAfter(calendarEnd, 'day')) {
    const isInMonth = cursor.month() === monthStart.month();
    const dateKey = formatDate(cursor);

    if (!isInMonth) {
      currentWeek.push({
        key: `filler-${dateKey}`,
        kind: 'filler',
      });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor = cursor.add(1, 'day');
      continue;
    }

    if (!isWorkingDay(employee, cursor)) {
      currentWeek.push({
        key: dateKey,
        kind: 'nonWorking',
      });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor = cursor.add(1, 'day');
      continue;
    }

    const record = getRecord(dateKey, employee.id);
    const hasMarkedState = record.present || record.markedAbsent || record.extraHours !== 0;

    if (!hasMarkedState) {
      currentWeek.push({
        key: dateKey,
        kind: 'idle',
        dayNumber: cursor.date(),
      });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor = cursor.add(1, 'day');
      continue;
    }

    const isPresent = record.present;
    const hasHours = record.extraHours !== 0;
    currentWeek.push({
      key: dateKey,
      kind: isPresent ? 'present' : 'absent',
      dayNumber: cursor.date(),
      label: hasHours ? formatCalendarHours(record.extraHours) : isPresent ? 'P' : 'A',
      isNegativeHours: hasHours && record.extraHours < 0,
      isPositiveHours: hasHours && record.extraHours > 0,
    });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }

    cursor = cursor.add(1, 'day');
  }

  if (currentWeek.length) {
    weeks.push(currentWeek);
  }

  return weeks
    .filter((week) => week.some((cell) => cell.kind !== 'filler' && cell.kind !== 'nonWorking'))
    .flat();
};

const HistoryScreen = () => {
  const navigation = useNavigation();
  const { employees, getSummaryForEmployee, getRecord, refreshData } = useAttendance();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [monthPickerConfig, setMonthPickerConfig] = useState(null);
  const currentMonth = useMemo(() => dayjs().startOf('month'), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.format('YYYY-MM-DD'));

  const selectedMonthDate = useMemo(() => dayjs(selectedMonth).startOf('month'), [selectedMonth]);
  const monthStart = useMemo(() => selectedMonthDate.startOf('month'), [selectedMonthDate]);
  const monthEnd = useMemo(() => selectedMonthDate.endOf('month'), [selectedMonthDate]);
  const headerMonthLabel = useMemo(() => selectedMonthDate.format('MMM YYYY'), [selectedMonthDate]);
  const isViewingCurrentMonth = selectedMonthDate.isSame(currentMonth, 'month');

  const changeSelectedMonth = (value) => {
    const normalized = dayjs(value).startOf('month');
    const nextMonth = normalized.isAfter(currentMonth, 'month') ? currentMonth : normalized;
    setSelectedMonth(nextMonth.format('YYYY-MM-DD'));
  };

  const openMonthPicker = () => {
    setMonthPickerConfig({
      year: selectedMonthDate.year(),
    });
  };

  const commitMonthPickerValue = (config, monthIndex) => {
    if (!config) {
      setMonthPickerConfig(null);
      return;
    }
    changeSelectedMonth(dayjs().year(config.year).month(monthIndex).startOf('month'));
    setMonthPickerConfig(null);
  };

  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerLeft: () => (
        <Pressable
          onPress={() => changeSelectedMonth(selectedMonthDate.subtract(1, 'month'))}
          style={({ pressed }) => [styles.headerNavButton, pressed && styles.pressed]}
          hitSlop={6}
        >
          <Text style={styles.headerNavText}>‹</Text>
        </Pressable>
      ),
      headerTitle: () => (
        <Pressable onPress={openMonthPicker} style={({ pressed }) => [styles.headerDateButton, pressed && styles.pressed]}>
          <Text numberOfLines={1} style={styles.headerDateText}>
            {headerMonthLabel}
          </Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => changeSelectedMonth(selectedMonthDate.add(1, 'month'))}
          disabled={isViewingCurrentMonth}
          style={({ pressed }) => [
            styles.headerNavButton,
            isViewingCurrentMonth && styles.headerNavButtonDisabled,
            pressed && !isViewingCurrentMonth && styles.pressed,
          ]}
          hitSlop={6}
        >
          <Text style={[styles.headerNavText, isViewingCurrentMonth && styles.headerNavTextDisabled]}>›</Text>
        </Pressable>
      ),
    });
  }, [headerMonthLabel, isViewingCurrentMonth, navigation, selectedMonthDate]);

  const employeeCards = useMemo(
    () =>
      employees
        .map((employee) => {
          const summary = getSummaryForEmployee(employee.id, monthStart, monthEnd);
          const attendanceRate = summary.workingDays > 0 ? Math.round((summary.presentDays / summary.workingDays) * 100) : 0;

          return {
            employee,
            summary,
            attendanceRate,
            cells: buildMonthCells(employee, monthStart, monthEnd, getRecord),
          };
        })
        .sort((a, b) => a.employee.name.localeCompare(b.employee.name)),
    [employees, getRecord, getSummaryForEmployee, monthEnd, monthStart]
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  const toggleExpandedEmployee = (employeeId) => {
    setExpandedEmployees((prev) => ({
      ...prev,
      [employeeId]: !prev[employeeId],
    }));
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {!employeeCards.length ? (
          <EmptyState title="No history found" subtitle="Add employees to unlock the monthly history view." />
        ) : null}

        {employeeCards.map(({ employee, summary, attendanceRate, cells }) => (
          <SectionCard key={employee.id} dense themed style={styles.employeeCard}>
            <Pressable onPress={() => toggleExpandedEmployee(employee.id)} style={({ pressed }) => [styles.employeeHeader, pressed && styles.pressed]}>
              <View style={styles.employeeHeaderText}>
                <View style={styles.employeeNameContainer}>
                  <Text numberOfLines={1} style={styles.employeeName}>
                    {employee.name}
                  </Text>
                </View>
                <View style={styles.employeeMetaCenter}>
                  <Text numberOfLines={1} style={styles.employeeMetaInline}>
                    {summary.presentDays}/{summary.workingDays} days
                  </Text>
                </View>
                <View style={styles.employeeMetaRight}>
                  <Text numberOfLines={1} style={styles.employeeMetaInline}>
                    {attendanceRate}%
                  </Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <Text style={styles.chevron}>{expandedEmployees[employee.id] ? '▾' : '▸'}</Text>
              </View>
            </Pressable>

            {expandedEmployees[employee.id] ? (
              <>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <Text key={label} style={styles.weekdayLabel}>
                      {label}
                    </Text>
                  ))}
                </View>

                <View style={styles.grid}>
                  {cells.map((cell) => {
                    const isMarked = cell.kind === 'present' || cell.kind === 'absent';
                    const shouldShowDayNumber = cell.kind === 'idle' || isMarked;
                    return (
                      <View
                        key={cell.key}
                        style={[
                          styles.cellSlot,
                          cell.kind === 'nonWorking' && styles.blankCellSlot,
                          cell.kind === 'filler' && styles.fillerCellSlot,
                        ]}
                      >
                        {cell.kind !== 'filler' && cell.kind !== 'nonWorking' ? (
                          <View
                            style={[
                              styles.cell,
                              cell.kind === 'present' && styles.presentCell,
                              cell.kind === 'absent' && styles.absentCell,
                            ]}
                          >
                            {shouldShowDayNumber ? (
                              <Text style={[styles.dayNumber, isMarked && styles.markedDayNumber]}>{cell.dayNumber}</Text>
                            ) : null}
                            {cell.label ? (
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.cellLabel,
                                  isMarked && styles.markedCellLabel,
                                  cell.isPositiveHours && styles.positiveHoursLabel,
                                  cell.isNegativeHours && styles.negativeHoursLabel,
                                ]}
                              >
                                {cell.label}
                              </Text>
                            ) : null}
                          </View>
                        ) : (
                          <>
                            {cell.kind === 'nonWorking' ? <View style={styles.blankCell} /> : null}
                          </>
                        )}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.dropdownSummaryRow}>
                  <Text style={styles.dropdownSummaryLabel}>Adjusted hours</Text>
                  <MetricPill
                    label={null}
                    value={formatHours(summary.extraHours)}
                    tone={summary.extraHours >= 0 ? 'present' : 'absent'}
                    compact
                    style={styles.summaryHoursPill}
                  />
                </View>
              </>
            ) : null}
          </SectionCard>
        ))}
      </ScrollView>

      {monthPickerConfig ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setMonthPickerConfig(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setMonthPickerConfig(null)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.monthPickerHeader}>
                <Pressable
                  onPress={() => setMonthPickerConfig((prev) => (prev ? { ...prev, year: prev.year - 1 } : prev))}
                  style={({ pressed }) => [styles.monthPickerYearButton, pressed && styles.pressed]}
                >
                  <Text style={styles.monthPickerYearButtonText}>‹</Text>
                </Pressable>
                <Text style={styles.monthPickerYearText}>{monthPickerConfig.year}</Text>
                <Pressable
                  onPress={() =>
                    setMonthPickerConfig((prev) =>
                      prev && prev.year < currentMonth.year() ? { ...prev, year: prev.year + 1 } : prev
                    )
                  }
                  style={({ pressed }) => [
                    styles.monthPickerYearButton,
                    monthPickerConfig.year >= currentMonth.year() && styles.headerNavButtonDisabled,
                    pressed && monthPickerConfig.year < currentMonth.year() && styles.pressed,
                  ]}
                  disabled={monthPickerConfig.year >= currentMonth.year()}
                >
                  <Text
                    style={[
                      styles.monthPickerYearButtonText,
                      monthPickerConfig.year >= currentMonth.year() && styles.headerNavTextDisabled,
                    ]}
                  >
                    ›
                  </Text>
                </Pressable>
              </View>
              <View style={styles.monthGrid}>
                {MONTH_LABELS.map((label, index) => {
                  const isDisabled =
                    monthPickerConfig.year === currentMonth.year() && index > currentMonth.month();
                  const isSelected =
                    monthPickerConfig.year === selectedMonthDate.year() && index === selectedMonthDate.month();
                  return (
                    <Pressable
                      key={label}
                      onPress={() => commitMonthPickerValue(monthPickerConfig, index)}
                      disabled={isDisabled}
                      style={({ pressed }) => [
                        styles.monthOption,
                        isSelected && styles.monthOptionSelected,
                        isDisabled && styles.monthOptionDisabled,
                        pressed && !isDisabled && styles.pressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.monthOptionText,
                          isSelected && styles.monthOptionTextSelected,
                          isDisabled && styles.monthOptionTextDisabled,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setMonthPickerConfig(null)} style={styles.modalAction}>
                  <Text style={styles.modalActionText}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 120,
  },
  headerNavButton: {
    minWidth: 50,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  headerNavButtonDisabled: {
    opacity: 0.35,
  },
  headerNavText: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.accentStrong,
  },
  headerNavTextDisabled: {
    color: colors.textSoft,
  },
  headerDateButton: {
    maxWidth: 180,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  headerDateText: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  employeeCard: {
    marginBottom: 12,
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  employeeHeaderText: {
    flex: 1,
    marginRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  employeeNameContainer: {
    flex: 1,
    marginRight: 8,
  },
  employeeMetaCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  employeeMetaRight: {
    minWidth: 56,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  employeeMetaInline: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  dropdownSummaryRow: {
    marginTop: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSummaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  summaryHoursPill: {
    minWidth: 86,
    justifyContent: 'center',
  },
  chevron: {
    marginLeft: 10,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSoft,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSoft,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -2,
  },
  cellSlot: {
    width: '14.2857%',
    aspectRatio: 1,
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  fillerCellSlot: {
    backgroundColor: 'transparent',
  },
  blankCellSlot: {
    backgroundColor: 'transparent',
  },
  cell: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceWarm,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  fillerCell: {
    backgroundColor: 'transparent',
  },
  blankCell: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  presentCell: {
    backgroundColor: '#c9dfce',
    borderColor: '#8fb29a',
  },
  absentCell: {
    backgroundColor: '#edd0ca',
    borderColor: '#c78f85',
  },
  dayNumber: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSoft,
  },
  markedDayNumber: {
    color: colors.text,
  },
  cellLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  markedCellLabel: {
    color: colors.text,
  },
  positiveHoursLabel: {
    color: colors.white,
    backgroundColor: colors.present,
    fontWeight: '900',
  },
  negativeHoursLabel: {
    color: colors.white,
    backgroundColor: colors.absent,
    fontWeight: '900',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
  },
  monthPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  monthPickerYearButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  monthPickerYearButtonText: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.accentStrong,
  },
  monthPickerYearText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accentStrong,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  monthOption: {
    width: '33.3333%',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  monthOptionSelected: {
    opacity: 1,
  },
  monthOptionDisabled: {
    opacity: 0.4,
  },
  monthOptionText: {
    overflow: 'hidden',
    textAlign: 'center',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceWarm,
    color: colors.accentStrong,
    fontSize: 15,
    fontWeight: '700',
  },
  monthOptionTextSelected: {
    backgroundColor: colors.accentStrong,
    color: colors.white,
  },
  monthOptionTextDisabled: {
    color: colors.textSoft,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  modalAction: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentStrong,
  },
});

export default HistoryScreen;
