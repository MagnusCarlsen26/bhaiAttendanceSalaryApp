import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAttendance } from '../context/AttendanceContext';
import { formatDate } from '../utils/dateUtils';
import { formatHours } from '../utils/formatters';
import { getCycleCompensationLabel } from '../utils/payroll';
import Screen from '../components/ui/Screen';
import SectionCard from '../components/ui/SectionCard';
import EmptyState from '../components/ui/EmptyState';
import MetricPill from '../components/ui/MetricPill';
import { colors, radius } from '../theme/tokens';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatCalendarHours = (value) => formatHours(value).replace(/h$/, '');

const BulkPresentIcon = ({ color = colors.accentStrong }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Path
      d="M7 5.5H17C18.3807 5.5 19.5 6.61929 19.5 8V17C19.5 18.3807 18.3807 19.5 17 19.5H7C5.61929 19.5 4.5 18.3807 4.5 17V8C4.5 6.61929 5.61929 5.5 7 5.5Z"
      stroke={color}
      strokeWidth="1.8"
    />
    <Path d="M8 3.75V7.25" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M16 3.75V7.25" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M7 10H17" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    <Path d="M9 14L11 16L15.5 11.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const ClockIcon = ({ color = colors.white }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="2" />
    <Path d="M12 7.5V12L15 13.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const getPaymentMarkerTone = (statusKey) => {
  if (statusKey === 'paid') {
    return 'paid';
  }
  if (statusKey === 'partial') {
    return 'partial';
  }
  return 'due';
};

const buildMonthCells = (employee, monthStart, monthEnd, getRecord, paymentMarkers = {}) => {
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

    const record = getRecord(dateKey, employee.id);
    const paymentMarker = paymentMarkers[dateKey] || null;
    const hasMarkedState = record.present || record.markedAbsent || record.extraHours !== 0;

    if (!hasMarkedState) {
      currentWeek.push({
        key: dateKey,
        kind: 'idle',
        dayNumber: cursor.date(),
        paymentMarker,
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
      paymentMarker,
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
    .filter((week) => week.some((cell) => cell.kind !== 'filler'))
    .flat();
};

const HistoryScreen = () => {
  const navigation = useNavigation();
  const {
    employees,
    getSummaryForEmployee,
    getRecord,
    refreshData,
    getEmployeePaymentStatusForMonth,
    getPayCyclesForEmployee,
    setPresenceStatus,
    setArrivalTime,
  } =
    useAttendance();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState({});
  const [monthPickerConfig, setMonthPickerConfig] = useState(null);
  const [bulkPresentEmployeeId, setBulkPresentEmployeeId] = useState(null);
  const [bulkConfirmEmployee, setBulkConfirmEmployee] = useState(null);
  const [bulkArrivalPickerConfig, setBulkArrivalPickerConfig] = useState(null);
  const [bulkEditingDate, setBulkEditingDate] = useState(null);
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

  const closeBulkMode = () => {
    setBulkPresentEmployeeId(null);
    setBulkConfirmEmployee(null);
    setBulkArrivalPickerConfig(null);
    setBulkEditingDate(null);
  };

  const openBulkConfirm = (employee) => {
    setBulkConfirmEmployee(employee);
  };

  const confirmBulkMode = () => {
    if (!bulkConfirmEmployee) {
      return;
    }

    setExpandedEmployees((prev) => ({
      ...prev,
      [bulkConfirmEmployee.id]: true,
    }));
    setBulkPresentEmployeeId(bulkConfirmEmployee.id);
    setBulkConfirmEmployee(null);
  };

  const toggleHistoryPresence = (employeeId, dateKey) => {
    const record = getRecord(dateKey, employeeId);
    const hasMarkedState = record.present || record.markedAbsent || record.extraHours !== 0;
    const nextStatus = !hasMarkedState || record.markedAbsent || !record.present ? 'present' : 'absent';
    setPresenceStatus(employeeId, nextStatus, dateKey);
  };

  const openBulkArrivalPicker = (employee, dateKey) => {
    const record = getRecord(dateKey, employee.id);
    setBulkEditingDate(dateKey);
    setBulkPresentEmployeeId(employee.id);
    setBulkArrivalPickerConfig({
      employeeId: employee.id,
      value: dayjs(`2000-01-01 ${record.arrivalTime || employee.shiftStart || '09:00'}`).toDate(),
    });
  };

  const commitBulkArrivalPickerValue = (config, value) => {
    if (!config || !bulkEditingDate) {
      setBulkArrivalPickerConfig(null);
      setBulkEditingDate(null);
      return;
    }

    setArrivalTime(config.employeeId, dayjs(value || config.value).format('HH:mm'), bulkEditingDate);
    setBulkArrivalPickerConfig(null);
    setBulkEditingDate(null);
  };

  const handleBulkArrivalTimeChange = (event, nextValue) => {
    if (!bulkArrivalPickerConfig) {
      return;
    }

    if (event?.type === 'dismissed') {
      setBulkArrivalPickerConfig(null);
      setBulkEditingDate(null);
      return;
    }

    const resolvedValue = nextValue || bulkArrivalPickerConfig.value;
    if (Platform.OS === 'android') {
      commitBulkArrivalPickerValue(bulkArrivalPickerConfig, resolvedValue);
      return;
    }

    setBulkArrivalPickerConfig((prev) => (prev ? { ...prev, value: resolvedValue } : prev));
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
          const paymentMarkers = getPayCyclesForEmployee(employee.id, selectedMonthDate).reduce((markers, cycle) => {
            const dateKey = formatDate(cycle.dueDate);
            markers[dateKey] = {
              icon: '💰',
              tone: getPaymentMarkerTone(cycle.status.key),
              label: cycle.status.label,
            };
            return markers;
          }, {});

          return {
            employee,
            summary,
            attendanceRate,
            cells: buildMonthCells(employee, monthStart, monthEnd, getRecord, paymentMarkers),
            paymentStatus: getEmployeePaymentStatusForMonth(employee.id, selectedMonthDate),
          };
        })
        .sort((a, b) => a.employee.name.localeCompare(b.employee.name)),
    [employees, getEmployeePaymentStatusForMonth, getPayCyclesForEmployee, getRecord, getSummaryForEmployee, monthEnd, monthStart, selectedMonthDate]
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
    if (bulkPresentEmployeeId === employeeId && expandedEmployees[employeeId]) {
      closeBulkMode();
    }

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

        {employeeCards.map(({ employee, summary, attendanceRate, cells, paymentStatus }) => {
          const isBulkActive = bulkPresentEmployeeId === employee.id;
          const isAnotherEmployeeActive = bulkPresentEmployeeId && !isBulkActive;
          return (
            <SectionCard
              key={employee.id}
              dense
              themed
              style={[styles.employeeCard, isBulkActive && styles.employeeCardActive, isAnotherEmployeeActive && styles.employeeCardMuted]}
            >
            <Pressable onPress={() => toggleExpandedEmployee(employee.id)} style={({ pressed }) => [styles.employeeHeader, pressed && styles.pressed]}>
              <View style={styles.employeeHeaderText}>
                <View style={styles.employeeMainMeta}>
                  <View style={styles.employeeNameContainer}>
                    <View style={styles.employeeNameRow}>
                      <Text numberOfLines={1} style={styles.employeeName}>
                        {employee.name}
                      </Text>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation?.();
                          openBulkConfirm(employee);
                        }}
                        onPressIn={(event) => event.stopPropagation?.()}
                        style={({ pressed }) => [
                          styles.bulkActionButton,
                          isBulkActive && styles.bulkActionButtonActive,
                          pressed && styles.pressed,
                        ]}
                        hitSlop={8}
                      >
                        <BulkPresentIcon color={isBulkActive ? colors.white : colors.accentStrong} />
                      </Pressable>
                    </View>
                    {isBulkActive ? (
                      <View style={styles.bulkModeBanner}>
                        <Text style={styles.bulkModeBannerText}>Bulk mode on</Text>
                        <Pressable onPress={closeBulkMode} style={({ pressed }) => [styles.bulkDoneButton, pressed && styles.pressed]}>
                          <Text style={styles.bulkDoneButtonText}>Done</Text>
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.employeePaymentRow}>
                    <Text numberOfLines={1} style={styles.employeePaymentMeta}>
                      {getCycleCompensationLabel(employee.paymentFrequency)}
                    </Text>
                    <MetricPill
                      label={null}
                      value={`${paymentStatus.icon} ${paymentStatus.label}`}
                      tone={paymentStatus.tone}
                      compact
                      style={styles.paymentStatusPill}
                    />
                  </View>
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
                    const isInteractive = isBulkActive && cell.kind !== 'filler' && cell.kind !== 'nonWorking';
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
                          <Pressable
                            disabled={!isInteractive}
                            delayLongPress={250}
                            onPress={() => toggleHistoryPresence(employee.id, cell.key)}
                            onLongPress={() => openBulkArrivalPicker(employee, cell.key)}
                            style={({ pressed }) => [
                              styles.cell,
                              cell.kind === 'present' && styles.presentCell,
                              cell.kind === 'absent' && styles.absentCell,
                              isInteractive && styles.cellInteractive,
                              isBulkActive && styles.cellEditable,
                              isAnotherEmployeeActive && styles.cellDimmed,
                              pressed && isInteractive && styles.cellPressed,
                            ]}
                          >
                            {shouldShowDayNumber ? (
                              <Text style={[styles.dayNumber, isMarked && styles.markedDayNumber]}>{cell.dayNumber}</Text>
                            ) : null}
                            {cell.label ? (
                              <View style={styles.cellMetaRow}>
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
                                {cell.paymentMarker ? (
                                  <Text
                                    accessibilityLabel={`Payment ${cell.paymentMarker.label}`}
                                    style={[
                                      styles.paymentMarker,
                                      cell.paymentMarker.tone === 'paid' && styles.paymentMarkerPaid,
                                      cell.paymentMarker.tone === 'partial' && styles.paymentMarkerPartial,
                                    ]}
                                  >
                                    {cell.paymentMarker.icon}
                                  </Text>
                                ) : null}
                              </View>
                            ) : null}
                            {!cell.label && cell.paymentMarker ? (
                              <Text
                                accessibilityLabel={`Payment ${cell.paymentMarker.label}`}
                                style={[
                                  styles.paymentMarker,
                                  styles.paymentMarkerStandalone,
                                  cell.paymentMarker.tone === 'paid' && styles.paymentMarkerPaid,
                                  cell.paymentMarker.tone === 'partial' && styles.paymentMarkerPartial,
                                ]}
                              >
                                {cell.paymentMarker.icon}
                              </Text>
                            ) : null}
                          </Pressable>
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
          );
        })}
      </ScrollView>

      {bulkConfirmEmployee ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setBulkConfirmEmployee(null)}>
          <Pressable style={styles.modalOverlay} onPress={() => setBulkConfirmEmployee(null)}>
            <Pressable style={styles.modalSheet} onPress={() => {}}>
              <View style={styles.bulkConfirmIconWrap}>
                <BulkPresentIcon color={colors.accentStrong} />
              </View>
              <Text style={styles.bulkConfirmTitle}>Start bulk present?</Text>
              <Text style={styles.bulkConfirmBody}>
                Edit {bulkConfirmEmployee.name}&apos;s attendance for {headerMonthLabel}. Long-press any date to set arrival time.
              </Text>
              <View style={styles.bulkConfirmActions}>
                <Pressable onPress={() => setBulkConfirmEmployee(null)} style={({ pressed }) => [styles.bulkConfirmSecondary, pressed && styles.pressed]}>
                  <Text style={styles.bulkConfirmSecondaryText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={confirmBulkMode} style={({ pressed }) => [styles.bulkConfirmPrimary, pressed && styles.pressed]}>
                  <Text style={styles.bulkConfirmPrimaryText}>Start</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

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

      {bulkArrivalPickerConfig && Platform.OS === 'android' ? (
        <DateTimePicker
          value={bulkArrivalPickerConfig.value}
          mode="time"
          display="clock"
          is24Hour={false}
          onChange={handleBulkArrivalTimeChange}
        />
      ) : null}

      {bulkArrivalPickerConfig && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setBulkArrivalPickerConfig(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.timePickerHeading}>
                <View style={styles.timePickerBadge}>
                  <ClockIcon color={colors.accentStrong} />
                </View>
                <Text style={styles.timePickerTitle}>Set arrival time</Text>
              </View>
              <DateTimePicker
                value={bulkArrivalPickerConfig.value}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={handleBulkArrivalTimeChange}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setBulkArrivalPickerConfig(null);
                    setBulkEditingDate(null);
                  }}
                  style={styles.modalAction}
                >
                  <Text style={styles.modalActionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => commitBulkArrivalPickerValue(bulkArrivalPickerConfig, bulkArrivalPickerConfig?.value)}
                  style={styles.modalAction}
                >
                  <Text style={styles.modalActionText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
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
  employeeCardActive: {
    borderColor: colors.presentBorder,
    backgroundColor: '#f1f7f2',
  },
  employeeCardMuted: {
    opacity: 0.72,
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
  employeeMainMeta: {
    flex: 1.5,
    marginRight: 8,
  },
  employeeNameContainer: {
    flex: 1,
  },
  employeeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeePaymentRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  employeePaymentMeta: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  paymentStatusPill: {
    marginRight: 0,
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
  bulkActionButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  bulkActionButtonActive: {
    borderColor: colors.present,
    backgroundColor: colors.present,
  },
  bulkModeBanner: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.presentSoft,
    borderWidth: 1,
    borderColor: colors.presentBorder,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bulkModeBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.present,
  },
  bulkDoneButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.present,
  },
  bulkDoneButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
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
  cellInteractive: {
    overflow: 'hidden',
  },
  cellEditable: {
    borderColor: colors.presentBorder,
  },
  cellDimmed: {
    opacity: 0.7,
  },
  cellPressed: {
    transform: [{ scale: 0.97 }],
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
  cellMetaRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
  paymentMarker: {
    fontSize: 12,
    lineHeight: 14,
  },
  paymentMarkerStandalone: {
    marginTop: 4,
  },
  paymentMarkerPaid: {
    opacity: 0.7,
  },
  paymentMarkerPartial: {
    opacity: 0.9,
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
  bulkConfirmIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarmStrong,
    marginBottom: 14,
  },
  bulkConfirmTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.accentStrong,
  },
  bulkConfirmBody: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  bulkConfirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 22,
  },
  bulkConfirmSecondary: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.pill,
    marginRight: 10,
  },
  bulkConfirmSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
  },
  bulkConfirmPrimary: {
    minHeight: 44,
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.accentStrong,
  },
  bulkConfirmPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
  },
  timePickerHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timePickerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceWarmStrong,
  },
  timePickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accentStrong,
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
