import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAttendance } from '../context/AttendanceContext';
import { formatDate, isWorkingDay } from '../utils/dateUtils';
import Screen from '../components/ui/Screen';
import SectionCard from '../components/ui/SectionCard';
import PrimaryButton from '../components/ui/PrimaryButton';
import EmptyState from '../components/ui/EmptyState';
import MetricPill from '../components/ui/MetricPill';
import { colors, radius } from '../theme/tokens';

const getTone = (record) => {
  if (record.present) {
    return 'present';
  }
  if (record.markedAbsent) {
    return 'absent';
  }
  return 'neutral';
};

const statusPalette = {
  present: {
    activeBackground: colors.present,
    activeBorder: colors.presentBorder,
    activeText: colors.white,
  },
  absent: {
    activeBackground: colors.absent,
    activeBorder: colors.absentBorder,
    activeText: colors.white,
  },
};

const ClockIcon = ({ color = colors.white }) => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="2" />
    <Path d="M12 7.5V12L15 13.75" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const HomeScreen = () => {
  const navigation = useNavigation();
  const {
    employees,
    getRecord,
    ensureRecordsForDate,
    setPresenceStatus,
    setArrivalTime,
    refreshData,
    seedTestData,
    clearTestData,
  } = useAttendance();
  const todayKey = formatDate();
  const today = useMemo(() => dayjs().startOf('day'), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [datePickerConfig, setDatePickerConfig] = useState(null);
  const [arrivalPickerConfig, setArrivalPickerConfig] = useState(null);
  const [isAddVisible, setIsAddVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const addButtonAnim = useRef(new Animated.Value(1)).current;
  const lastOffsetRef = useRef(0);

  const clampToToday = (value) => {
    const normalized = dayjs(value).startOf('day');
    return normalized.isAfter(today, 'day') ? today : normalized;
  };

  const changeSelectedDate = (value) => {
    const nextDate = formatDate(clampToToday(value));
    setSelectedDate(nextDate);
  };

  useEffect(() => {
    ensureRecordsForDate(selectedDate);
  }, [employees.length, ensureRecordsForDate, selectedDate]);

  useEffect(() => {
    navigation.setOptions({
      headerTitleAlign: 'center',
      headerLeft: () => (
        <Pressable
          onPress={() => changeSelectedDate(dayjs(selectedDate).subtract(1, 'day'))}
          style={({ pressed }) => [styles.headerNavButton, pressed && styles.pressed]}
          hitSlop={6}
        >
          <Text style={styles.headerNavText}>‹</Text>
        </Pressable>
      ),
      headerTitle: () => (
        <Pressable onPress={openDatePicker} style={({ pressed }) => [styles.headerDateButton, pressed && styles.pressed]}>
          <Text numberOfLines={1} style={styles.headerDateText}>
            {headerDateLabel}
          </Text>
        </Pressable>
      ),
      headerRight: () => (
        <Pressable
          onPress={() => changeSelectedDate(dayjs(selectedDate).add(1, 'day'))}
          disabled={isViewingToday}
          style={({ pressed }) => [
            styles.headerNavButton,
            isViewingToday && styles.headerNavButtonDisabled,
            pressed && !isViewingToday && styles.pressed,
          ]}
          hitSlop={6}
        >
          <Text style={[styles.headerNavText, isViewingToday && styles.headerNavTextDisabled]}>›</Text>
        </Pressable>
      ),
    });
  }, [headerDateLabel, isViewingToday, navigation, selectedDate]);

  const openDatePicker = () => {
    const parsed = dayjs(selectedDate, 'YYYY-MM-DD', true);
    setDatePickerConfig({
      value: (parsed.isValid() ? parsed : today).toDate(),
    });
  };

  const commitDatePickerValue = (config, value) => {
    if (!config) {
      setDatePickerConfig(null);
      return;
    }
    changeSelectedDate(value || config.value);
    setDatePickerConfig(null);
  };

  const handleDateChange = (event, nextValue) => {
    if (!datePickerConfig) {
      return;
    }
    if (event?.type === 'dismissed') {
      setDatePickerConfig(null);
      return;
    }
    const resolvedValue = nextValue || datePickerConfig.value;
    if (Platform.OS === 'android') {
      commitDatePickerValue(datePickerConfig, resolvedValue);
      return;
    }
    setDatePickerConfig((prev) => (prev ? { ...prev, value: resolvedValue } : prev));
  };

  const visibleEmployees = useMemo(
    () => employees.filter((employee) => isWorkingDay(employee, selectedDate)),
    [employees, selectedDate]
  );

  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    visibleEmployees.forEach((employee) => {
      const record = getRecord(selectedDate, employee.id);
      if (record.present) {
        present += 1;
      } else if (record.markedAbsent) {
        absent += 1;
      }
    });

    return {
      total: visibleEmployees.length,
      present,
      absent,
      open: Math.max(visibleEmployees.length - present - absent, 0),
    };
  }, [getRecord, selectedDate, visibleEmployees]);

  const testEmployeeCount = useMemo(() => employees.filter((employee) => employee?.isTestData).length, [employees]);
  const selectedDateLabel = useMemo(() => dayjs(selectedDate).format('DD MMM YYYY'), [selectedDate]);
  const headerDateLabel = useMemo(() => dayjs(selectedDate).format('ddd, D MMM'), [selectedDate]);
  const isViewingToday = selectedDate === todayKey;

  const setAddButtonVisible = (visible) => {
    setIsAddVisible((current) => {
      if (current === visible) {
        return current;
      }
      Animated.timing(addButtonAnim, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
      return visible;
    });
  };

  const handleScroll = (event) => {
    const nextOffset = event.nativeEvent.contentOffset.y;
    const delta = nextOffset - lastOffsetRef.current;

    if (nextOffset <= 8) {
      setAddButtonVisible(true);
    } else if (delta > 8) {
      setAddButtonVisible(false);
    } else if (delta < -8) {
      setAddButtonVisible(true);
    }

    lastOffsetRef.current = nextOffset;
  };

  const renderStatusButton = (employeeId, record, status, label) => {
    const isActive = (status === 'present' && record.present) || (status === 'absent' && record.markedAbsent);
    const palette = statusPalette[status];

    return (
      <Pressable
        onPress={() => setPresenceStatus(employeeId, isActive ? 'unmarked' : status, selectedDate)}
        style={({ pressed }) => [
          styles.statusButton,
          status === 'absent' && styles.statusButtonGap,
          {
            backgroundColor: isActive ? palette.activeBackground : colors.surface,
            borderColor: isActive ? palette.activeBorder : colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.statusButtonText,
            { color: isActive ? palette.activeText : colors.text },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const renderEmployee = ({ item }) => {
    const record = getRecord(selectedDate, item.id);
    const tone = getTone(record);
    const handleTimeChipPress = () => {
      setEditingEmployee(item);
      setArrivalPickerConfig({
        value: dayjs(`2000-01-01 ${record.arrivalTime || item.shiftStart || '09:00'}`).toDate(),
      });
    };

    return (
      <View style={styles.employeeCard}>
        <View style={styles.employeeRow}>
          <View style={styles.employeeMeta}>
            <View style={styles.employeeTextWrap}>
              <Pressable onPress={() => navigation.navigate('AddEmployee', { employee: item })} hitSlop={6}>
                <Text numberOfLines={1} style={[styles.employeeName, tone === 'absent' && styles.employeeNameAbsent]}>
                  {item.name}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.statusRow}>
            {renderStatusButton(item.id, record, 'present', 'P')}
            {renderStatusButton(item.id, record, 'absent', 'A')}
          </View>

          <Pressable
            onPress={handleTimeChipPress}
            style={({ pressed }) => [
              styles.timeChip,
              tone === 'present' && styles.hoursChipPresent,
              tone === 'absent' && styles.hoursChipAbsent,
              pressed && styles.pressed,
            ]}
          >
            {record.arrivalTime ? (
              <Text style={styles.timeChipValue}>{dayjs(`2000-01-01 ${record.arrivalTime}`).format('hh:mm A')}</Text>
            ) : (
              <ClockIcon />
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  const handleSeedTestData = () => {
    seedTestData();
    Alert.alert('Test data ready', 'Added 10 test employees with attendance records for the last 60 days.');
  };

  const handleClearTestData = () => {
    clearTestData();
    Alert.alert('Test data removed', 'Deleted all seeded test employees and their records.');
  };

  const commitArrivalPickerValue = (config, value) => {
    if (!config || !editingEmployee) {
      setArrivalPickerConfig(null);
      return;
    }

    setArrivalTime(editingEmployee.id, dayjs(value || config.value).format('HH:mm'), selectedDate);
    setArrivalPickerConfig(null);
    setEditingEmployee(null);
  };

  const handleArrivalTimeChange = (event, nextValue) => {
    if (!arrivalPickerConfig) {
      return;
    }
    if (event?.type === 'dismissed') {
      setArrivalPickerConfig(null);
      setEditingEmployee(null);
      return;
    }

    const resolvedValue = nextValue || arrivalPickerConfig.value;
    if (Platform.OS === 'android') {
      commitArrivalPickerValue(arrivalPickerConfig, resolvedValue);
      return;
    }

    setArrivalPickerConfig((prev) => (prev ? { ...prev, value: resolvedValue } : prev));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      ensureRecordsForDate(selectedDate);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen>
      <FlatList
        data={visibleEmployees}
        renderItem={renderEmployee}
        keyExtractor={(item) => item.id}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.rowDivider} />}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <SectionCard tinted dense themed style={styles.summaryCard}>
              <View style={styles.metricsRow}>
                <MetricPill label="Total" value={stats.total} tone="accent" compact style={styles.metricPill} />
                <MetricPill label="Present" value={stats.present} tone="present" compact style={styles.metricPill} />
                <MetricPill label="Absent" value={stats.absent} tone="absent" compact style={styles.metricPill} />
                <View style={styles.summaryBadge}>
                  <Text style={styles.summaryBadgeLabel}>Open</Text>
                  <Text style={styles.summaryBadgeValue}>{stats.open}</Text>
                </View>
              </View>

              <View style={styles.testActions}>
                <Pressable onPress={handleSeedTestData} style={({ pressed }) => [styles.testActionButton, pressed && styles.pressed]}>
                  <Text style={styles.testActionPrimaryText}>Load test data</Text>
                </Pressable>
                {testEmployeeCount > 0 ? (
                  <Pressable
                    onPress={handleClearTestData}
                    style={({ pressed }) => [styles.testActionButton, styles.testActionButtonDanger, pressed && styles.pressed]}
                  >
                    <Text style={styles.testActionDangerText}>Delete test</Text>
                  </Pressable>
                ) : null}
              </View>
            </SectionCard>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No one is scheduled"
            subtitle={`No employees are scheduled for ${selectedDateLabel}.`}
          />
        }
        ListFooterComponent={<View style={styles.footerSpace} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />

      <Animated.View
        pointerEvents={isAddVisible ? 'auto' : 'none'}
        style={[
          styles.fabWrap,
          {
            opacity: addButtonAnim,
            transform: [
              {
                translateY: addButtonAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <PrimaryButton
          label="+"
          onPress={() => navigation.navigate('AddEmployee')}
          style={styles.fabButton}
          textStyle={styles.fabButtonText}
        />
      </Animated.View>

      {datePickerConfig && Platform.OS === 'android' ? (
        <DateTimePicker
          value={datePickerConfig.value}
          mode="date"
          display="calendar"
          maximumDate={today.toDate()}
          onChange={handleDateChange}
        />
      ) : null}

      {datePickerConfig && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setDatePickerConfig(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <DateTimePicker
                value={datePickerConfig.value}
                mode="date"
                display="spinner"
                maximumDate={today.toDate()}
                onChange={handleDateChange}
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setDatePickerConfig(null)} style={styles.modalAction}>
                  <Text style={styles.modalActionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => commitDatePickerValue(datePickerConfig, datePickerConfig?.value)}
                  style={styles.modalAction}
                >
                  <Text style={styles.modalActionText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {arrivalPickerConfig && Platform.OS === 'android' ? (
        <DateTimePicker value={arrivalPickerConfig.value} mode="time" display="clock" is24Hour={false} onChange={handleArrivalTimeChange} />
      ) : null}

      {arrivalPickerConfig && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setArrivalPickerConfig(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <DateTimePicker
                value={arrivalPickerConfig.value}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={handleArrivalTimeChange}
              />
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    setArrivalPickerConfig(null);
                    setEditingEmployee(null);
                  }}
                  style={styles.modalAction}
                >
                  <Text style={styles.modalActionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => commitArrivalPickerValue(arrivalPickerConfig, arrivalPickerConfig?.value)}
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
  listContent: {
    paddingBottom: 140,
  },
  listHeader: {
    paddingTop: 6,
    paddingBottom: 14,
  },
  summaryCard: {
    overflow: 'hidden',
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
  summaryBadge: {
    minWidth: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.accentStrong,
    marginBottom: 8,
  },
  summaryBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: '#d9c7b1',
  },
  summaryBadgeValue: {
    marginTop: 2,
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricPill: {
    marginBottom: 8,
  },
  testActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  testActionButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginTop: 6,
  },
  testActionButtonDanger: {
    backgroundColor: colors.absentSoft,
    borderColor: colors.absentBorder,
  },
  testActionPrimaryText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 12,
  },
  testActionDangerText: {
    color: colors.absent,
    fontWeight: '700',
    fontSize: 12,
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  employeeCard: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  employeeMeta: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  employeeTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.accentStrong,
  },
  employeeNameAbsent: {
    color: '#704238',
  },
  employeeSubtext: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  timeChip: {
    minWidth: 92,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.md,
    backgroundColor: colors.accentStrong,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hoursChipPresent: {
    backgroundColor: colors.present,
  },
  hoursChipAbsent: {
    backgroundColor: colors.absent,
  },
  timeChipValue: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  statusButton: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  statusButtonGap: {
    marginLeft: 10,
  },
  statusButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  footerSpace: {
    height: 44,
  },
  fabWrap: {
    position: 'absolute',
    right: 18,
    bottom: 104,
    alignItems: 'flex-end',
  },
  fabButton: {
    width: 52,
    minHeight: 52,
    paddingHorizontal: 0,
    borderRadius: 26,
  },
  fabButtonText: {
    fontSize: 26,
    lineHeight: 26,
    fontWeight: '500',
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
  pressed: {
    opacity: 0.84,
  },
});

export default HomeScreen;
