import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useAttendance } from '../context/AttendanceContext';
import Screen from '../components/ui/Screen';
import SectionCard from '../components/ui/SectionCard';
import PrimaryButton from '../components/ui/PrimaryButton';
import FormField from '../components/ui/FormField';
import { colors, radius, type } from '../theme/tokens';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DEFAULT_SHIFT_START = '09:00';
const DEFAULT_SHIFT_END = '18:00';

const getDefaultNonWorkingDays = (workingDaysPerWeek) => {
  const normalizedWorkingDays = Number.isFinite(workingDaysPerWeek)
    ? Math.min(7, Math.max(0, Math.floor(workingDaysPerWeek)))
    : 0;
  const daysOff = normalizedWorkingDays > 0 && normalizedWorkingDays < 7 ? 7 - normalizedWorkingDays : 0;

  if (daysOff <= 0) {
    return [];
  }

  if (daysOff === 1) {
    return ['Sunday'];
  }

  if (daysOff === 2) {
    return ['Saturday', 'Sunday'];
  }

  return weekdays.slice(0, daysOff);
};

const clampWorkingDays = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.min(7, Math.max(0, Math.floor(numericValue)));
};

const AddEmployeeScreen = ({ navigation, route }) => {
  const { addEmployee, updateEmployee } = useAttendance();
  const employeeToEdit = route?.params?.employee ?? null;
  const isEditMode = Boolean(employeeToEdit?.id);
  const [name, setName] = useState('');
  const [expectedHours, setExpectedHours] = useState('');
  const [workingDays, setWorkingDays] = useState('');
  const [monthlySalary, setMonthlySalary] = useState('');
  const [nonWorkingDays, setNonWorkingDays] = useState([]);
  const [shiftStart, setShiftStart] = useState(null);
  const [shiftEnd, setShiftEnd] = useState(null);
  const [timePickerConfig, setTimePickerConfig] = useState(null);

  useEffect(() => {
    if (!employeeToEdit) {
      setName('');
      setExpectedHours('');
      setWorkingDays('');
      setMonthlySalary('');
      setNonWorkingDays([]);
      setShiftStart(null);
      setShiftEnd(null);
      return;
    }

    setName(employeeToEdit.name || '');
    setExpectedHours(String(employeeToEdit.expectedHoursPerDay ?? ''));
    setWorkingDays(String(employeeToEdit.workingDaysPerWeek ?? ''));
    setMonthlySalary(String(employeeToEdit.monthlySalary ?? ''));
    const fallbackNonWorkingDays = getDefaultNonWorkingDays(employeeToEdit.workingDaysPerWeek);

    setNonWorkingDays(
      Array.isArray(employeeToEdit.nonWorkingDays) && employeeToEdit.nonWorkingDays.length > 0
        ? employeeToEdit.nonWorkingDays
        : fallbackNonWorkingDays
    );
    setShiftStart(dayjs(`2000-01-01 ${employeeToEdit.shiftStart || DEFAULT_SHIFT_START}`));
    setShiftEnd(dayjs(`2000-01-01 ${employeeToEdit.shiftEnd || DEFAULT_SHIFT_END}`));
  }, [employeeToEdit]);

  const workingDaysPerWeek = clampWorkingDays(workingDays);
  const nonWorkingDayCount = workingDaysPerWeek > 0 && workingDaysPerWeek < 7 ? 7 - workingDaysPerWeek : 0;
  const requiresNonWorkingDays = nonWorkingDayCount > 0;

  useEffect(() => {
    if (!requiresNonWorkingDays) {
      setNonWorkingDays([]);
      return;
    }
    setNonWorkingDays((prev) => (prev.length <= nonWorkingDayCount ? prev : prev.slice(0, nonWorkingDayCount)));
  }, [nonWorkingDayCount, requiresNonWorkingDays]);

  const toggleNonWorkingDay = (day) => {
    setNonWorkingDays((prev) => {
      if (prev.includes(day)) {
        return prev.filter((value) => value !== day);
      }
      if (prev.length >= nonWorkingDayCount) {
        return prev;
      }
      return [...prev, day];
    });
  };

  const openTimePicker = (target) => {
    const currentValue = target === 'shiftStart' ? shiftStart : shiftEnd;
    const fallback = dayjs().startOf('minute');
    setTimePickerConfig({
      target,
      value: currentValue ? currentValue.toDate() : fallback.toDate(),
    });
  };

  const commitTimePickerValue = (config, value) => {
    if (!config) {
      setTimePickerConfig(null);
      return;
    }
    const nextDate = value || config.value;
    const formattedValue = dayjs(nextDate);
    if (config.target === 'shiftStart') {
      setShiftStart(formattedValue);
    } else {
      setShiftEnd(formattedValue);
    }
    setTimePickerConfig(null);
  };

  const handleTimeChange = (event, selectedDate) => {
    if (!timePickerConfig) {
      return;
    }
    if (event?.type === 'dismissed') {
      setTimePickerConfig(null);
      return;
    }
    const nextDate = selectedDate || timePickerConfig.value;
    if (Platform.OS === 'android') {
      commitTimePickerValue(timePickerConfig, nextDate);
      return;
    }
    setTimePickerConfig((prev) => (prev ? { ...prev, value: nextDate } : prev));
  };

  const allFieldsFilled = useMemo(() => {
    const trimmedName = name.trim();
    const trimmedExpectedHours = expectedHours.trim();
    const trimmedWorkingDays = workingDays.trim();
    const trimmedMonthlySalary = monthlySalary.trim();

    if (!trimmedName || !trimmedExpectedHours || !trimmedWorkingDays || !trimmedMonthlySalary) {
      return false;
    }
    if (!shiftStart?.isValid?.() || !shiftEnd?.isValid?.()) {
      return false;
    }
    if (requiresNonWorkingDays && nonWorkingDays.length !== nonWorkingDayCount) {
      return false;
    }
    return true;
  }, [
    expectedHours,
    monthlySalary,
    name,
    nonWorkingDayCount,
    nonWorkingDays,
    requiresNonWorkingDays,
    shiftEnd,
    shiftStart,
    workingDays,
  ]);

  const handleSave = () => {
    const resolvedName = name.trim() || employeeToEdit?.name || '';
    const resolvedExpectedHours = expectedHours.trim() || String(employeeToEdit?.expectedHoursPerDay ?? '');
    const resolvedWorkingDays = workingDays.trim() || String(employeeToEdit?.workingDaysPerWeek ?? '');
    const resolvedMonthlySalary = monthlySalary.trim() || String(employeeToEdit?.monthlySalary ?? '');
    const resolvedWorkingDaysPerWeek = clampWorkingDays(resolvedWorkingDays);
    const resolvedNonWorkingDayCount =
      resolvedWorkingDaysPerWeek > 0 && resolvedWorkingDaysPerWeek < 7 ? 7 - resolvedWorkingDaysPerWeek : 0;
    const resolvedRequiresNonWorkingDays = resolvedNonWorkingDayCount > 0;
    const fallbackNonWorkingDays = getDefaultNonWorkingDays(resolvedWorkingDaysPerWeek);
    const resolvedNonWorkingDays =
      nonWorkingDays.length > 0
        ? nonWorkingDays
        : Array.isArray(employeeToEdit?.nonWorkingDays) && employeeToEdit.nonWorkingDays.length > 0
          ? employeeToEdit.nonWorkingDays
          : fallbackNonWorkingDays;
    const resolvedShiftStart =
      shiftStart?.isValid?.() ? shiftStart : dayjs(`2000-01-01 ${employeeToEdit?.shiftStart || DEFAULT_SHIFT_START}`);
    const resolvedShiftEnd =
      shiftEnd?.isValid?.() ? shiftEnd : dayjs(`2000-01-01 ${employeeToEdit?.shiftEnd || DEFAULT_SHIFT_END}`);

    const hasRequiredValues =
      resolvedName &&
      resolvedExpectedHours &&
      resolvedWorkingDays &&
      resolvedMonthlySalary &&
      resolvedShiftStart?.isValid?.() &&
      resolvedShiftEnd?.isValid?.();

    if (!hasRequiredValues) {
      Alert.alert('Validation', 'Complete every required field.');
      return;
    }
    if (resolvedRequiresNonWorkingDays && resolvedNonWorkingDays.length !== resolvedNonWorkingDayCount) {
      Alert.alert('Validation', `Choose ${resolvedNonWorkingDayCount} off day${resolvedNonWorkingDayCount === 1 ? '' : 's'}.`);
      return;
    }

    const employeePayload = {
      name: resolvedName,
      expectedHoursPerDay: Number(resolvedExpectedHours),
      workingDaysPerWeek: resolvedWorkingDaysPerWeek,
      nonWorkingDays: resolvedRequiresNonWorkingDays ? resolvedNonWorkingDays : [],
      shiftStart: resolvedShiftStart.format('HH:mm'),
      shiftEnd: resolvedShiftEnd.format('HH:mm'),
      monthlySalary: Number(resolvedMonthlySalary),
    };

    if (isEditMode) {
      updateEmployee(employeeToEdit.id, employeePayload);
    } else {
      addEmployee(employeePayload);
    }
    navigation.goBack();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionCard style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <FormField label="Name" value={name} onChangeText={setName} placeholder="Ravi" />
        </SectionCard>

        <SectionCard style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <FormField
            label="Hours / day"
            value={expectedHours}
            onChangeText={setExpectedHours}
            placeholder="8"
            keyboardType="numeric"
          />
          <FormField
            label="Days / week"
            value={workingDays}
            onChangeText={setWorkingDays}
            placeholder="6"
            keyboardType="numeric"
            style={styles.fieldSpacing}
          />

          {requiresNonWorkingDays ? (
            <View style={styles.fieldSpacing}>
              <Text style={styles.fieldLabel}>Off days</Text>
              <View style={styles.weekdayWrap}>
                {weekdays.map((day) => {
                  const selected = nonWorkingDays.includes(day);
                  const disabled = !selected && nonWorkingDays.length >= nonWorkingDayCount;
                  return (
                    <Pressable
                      key={day}
                      disabled={disabled}
                      onPress={() => toggleNonWorkingDay(day)}
                      style={({ pressed }) => [
                        styles.weekdayChip,
                        selected && styles.weekdayChipSelected,
                        disabled && styles.weekdayChipDisabled,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={[styles.weekdayText, selected && styles.weekdayTextSelected]}>{day.slice(0, 3)}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.helperText}>Choose {nonWorkingDayCount} off day{nonWorkingDayCount === 1 ? '' : 's'}.</Text>
            </View>
          ) : null}

          <View style={[styles.timeRow, styles.fieldSpacing]}>
            <View style={styles.timeColumn}>
              <Text style={styles.fieldLabel}>Shift start</Text>
              <Pressable style={styles.timeButton} onPress={() => openTimePicker('shiftStart')}>
                <Text style={[styles.timeText, !shiftStart && styles.timePlaceholder]}>
                  {shiftStart ? shiftStart.format('hh:mm A') : 'Select'}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.timeColumn, styles.timeColumnGap]}>
              <Text style={styles.fieldLabel}>Shift end</Text>
              <Pressable style={styles.timeButton} onPress={() => openTimePicker('shiftEnd')}>
                <Text style={[styles.timeText, !shiftEnd && styles.timePlaceholder]}>
                  {shiftEnd ? shiftEnd.format('hh:mm A') : 'Select'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>

        <SectionCard style={styles.section} tinted>
          <Text style={styles.sectionTitle}>Compensation</Text>
          <FormField
            label="Monthly salary"
            value={monthlySalary}
            onChangeText={setMonthlySalary}
            placeholder="50000"
            keyboardType="numeric"
          />
        </SectionCard>

        <PrimaryButton
          label={isEditMode ? 'Update employee' : 'Save employee'}
          onPress={handleSave}
          disabled={!isEditMode && !allFieldsFilled}
          style={styles.saveButton}
        />
      </ScrollView>

      {timePickerConfig && Platform.OS === 'android' ? (
        <DateTimePicker
          value={timePickerConfig.value}
          mode="time"
          display="clock"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      ) : null}

      {timePickerConfig && Platform.OS === 'ios' ? (
        <Modal visible transparent animationType="slide" onRequestClose={() => setTimePickerConfig(null)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <DateTimePicker
                value={timePickerConfig.value}
                mode="time"
                display="spinner"
                is24Hour={false}
                onChange={handleTimeChange}
              />
              <View style={styles.modalActions}>
                <Pressable onPress={() => setTimePickerConfig(null)} style={styles.modalAction}>
                  <Text style={styles.modalActionText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => commitTimePickerValue(timePickerConfig, timePickerConfig?.value)}
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
    paddingBottom: 48,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 14,
  },
  fieldSpacing: {
    marginTop: 16,
  },
  fieldLabel: {
    ...type.eyebrow,
    color: colors.textMuted,
    marginBottom: 8,
  },
  weekdayWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekdayChip: {
    minWidth: 62,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  weekdayChipSelected: {
    backgroundColor: colors.accentStrong,
    borderColor: colors.accentStrong,
  },
  weekdayChipDisabled: {
    opacity: 0.4,
  },
  weekdayText: {
    color: colors.text,
    fontWeight: '700',
  },
  weekdayTextSelected: {
    color: colors.white,
  },
  helperText: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 13,
  },
  timeRow: {
    flexDirection: 'row',
  },
  timeColumn: {
    flex: 1,
  },
  timeColumnGap: {
    marginLeft: 10,
  },
  timeButton: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  timePlaceholder: {
    color: colors.textSoft,
  },
  saveButton: {
    marginTop: 8,
    marginBottom: 24,
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
    paddingBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 18,
  },
  modalAction: {
    marginLeft: 20,
    paddingVertical: 8,
  },
  modalActionText: {
    color: colors.accentStrong,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.84,
  },
});

export default AddEmployeeScreen;
