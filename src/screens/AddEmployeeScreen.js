import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';
import { useAttendance } from '../context/AttendanceContext';
import Screen from '../components/ui/Screen';
import SectionCard from '../components/ui/SectionCard';
import PrimaryButton from '../components/ui/PrimaryButton';
import FormField from '../components/ui/FormField';
import { colors, radius, type } from '../theme/tokens';
import { getMonthlyHolidays } from '../utils/dateUtils';
import { convertCompensation, getCompensationLabel } from '../utils/payroll';

const DEFAULT_SHIFT_START = '09:00';
const DEFAULT_SHIFT_END = '18:00';
const EMPLOYEE_DRAFT_PREFIX = '@attendanceapp:employee-draft:';
const PAYMENT_FREQUENCY_OPTIONS = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
];

const clampMonthlyHolidays = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.min(30, Math.max(0, Math.floor(numericValue)));
};

const buildInitialFormState = (employee) => ({
  name: employee?.name || '',
  expectedHours: String(employee?.expectedHoursPerDay ?? ''),
  monthlyHolidays: String(getMonthlyHolidays(employee) ?? ''),
  monthlySalary: String(employee?.compensationAmount ?? employee?.monthlySalary ?? ''),
  paymentFrequency: employee?.paymentFrequency || 'monthly',
  shiftStart: employee?.shiftStart || DEFAULT_SHIFT_START,
  shiftEnd: employee?.shiftEnd || DEFAULT_SHIFT_END,
});

const serializeFormState = (state) =>
  JSON.stringify({
    name: state.name.trim(),
    expectedHours: state.expectedHours.trim(),
    monthlyHolidays: state.monthlyHolidays.trim(),
    monthlySalary: state.monthlySalary.trim(),
    paymentFrequency: state.paymentFrequency,
    shiftStart: state.shiftStart,
    shiftEnd: state.shiftEnd,
  });

const getDraftStorageKey = (employeeId) => `${EMPLOYEE_DRAFT_PREFIX}${employeeId ? `edit:${employeeId}` : 'new'}`;

const AddEmployeeScreen = ({ navigation, route }) => {
  const { addEmployee, updateEmployee } = useAttendance();
  const employeeToEdit = route?.params?.employee ?? null;
  const isEditMode = Boolean(employeeToEdit?.id);
  const draftStorageKey = useMemo(() => getDraftStorageKey(employeeToEdit?.id), [employeeToEdit?.id]);
  const baseFormState = useMemo(() => buildInitialFormState(employeeToEdit), [employeeToEdit]);
  const [formState, setFormState] = useState(baseFormState);
  const [timePickerConfig, setTimePickerConfig] = useState(null);
  const [draftReady, setDraftReady] = useState(false);
  const isDirtyRef = useRef(false);

  useEffect(() => {
    isDirtyRef.current = serializeFormState(formState) !== serializeFormState(baseFormState);
  }, [baseFormState, formState]);

  useEffect(() => {
    let isActive = true;

    const restoreDraft = async () => {
      setDraftReady(false);
      try {
        const storedDraft = await AsyncStorage.getItem(draftStorageKey);
        if (!isActive) {
          return;
        }

        if (storedDraft) {
          const parsed = JSON.parse(storedDraft);
          setFormState({
            ...baseFormState,
            ...parsed,
            paymentFrequency: parsed?.paymentFrequency || baseFormState.paymentFrequency,
            shiftStart: parsed?.shiftStart || baseFormState.shiftStart,
            shiftEnd: parsed?.shiftEnd || baseFormState.shiftEnd,
          });
        } else {
          setFormState(baseFormState);
        }
      } catch (error) {
        if (isActive) {
          setFormState(baseFormState);
        }
      } finally {
        if (isActive) {
          setDraftReady(true);
        }
      }
    };

    restoreDraft();

    return () => {
      isActive = false;
      if (!isDirtyRef.current) {
        AsyncStorage.removeItem(draftStorageKey).catch(() => undefined);
      }
    };
  }, [baseFormState, draftStorageKey]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    if (!isDirtyRef.current) {
      AsyncStorage.removeItem(draftStorageKey).catch(() => undefined);
      return;
    }

    AsyncStorage.setItem(draftStorageKey, serializeFormState(formState)).catch(() => undefined);
  }, [draftReady, draftStorageKey, formState]);

  const updateField = (key, value) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handlePaymentFrequencyChange = (nextFrequency) => {
    setFormState((prev) => {
      if (prev.paymentFrequency === nextFrequency) {
        return prev;
      }

      const currentAmount = prev.monthlySalary.trim();
      const convertedAmount = currentAmount
        ? String(convertCompensation(currentAmount, prev.paymentFrequency, nextFrequency))
        : currentAmount;

      return {
        ...prev,
        paymentFrequency: nextFrequency,
        monthlySalary: convertedAmount,
      };
    });
  };

  const openTimePicker = (target) => {
    const currentValue = formState[target];
    const fallback = dayjs().startOf('minute');
    setTimePickerConfig({
      target,
      value: currentValue ? dayjs(`2000-01-01 ${currentValue}`).toDate() : fallback.toDate(),
    });
  };

  const commitTimePickerValue = (config, value) => {
    if (!config) {
      setTimePickerConfig(null);
      return;
    }

    const formattedValue = dayjs(value || config.value).format('HH:mm');
    updateField(config.target, formattedValue);
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
    const trimmedName = formState.name.trim();
    const trimmedExpectedHours = formState.expectedHours.trim();
    const trimmedMonthlyHolidays = formState.monthlyHolidays.trim();
    const trimmedMonthlySalary = formState.monthlySalary.trim();

    return Boolean(
      trimmedName &&
        trimmedExpectedHours &&
        trimmedMonthlyHolidays &&
        trimmedMonthlySalary &&
        formState.shiftStart &&
        formState.shiftEnd
    );
  }, [formState]);

  const handleSave = async () => {
    const resolvedName = formState.name.trim() || employeeToEdit?.name || '';
    const resolvedExpectedHours = formState.expectedHours.trim() || String(employeeToEdit?.expectedHoursPerDay ?? '');
    const resolvedMonthlyHolidays = formState.monthlyHolidays.trim() || String(getMonthlyHolidays(employeeToEdit));
    const resolvedMonthlySalary =
      formState.monthlySalary.trim() || String(employeeToEdit?.compensationAmount ?? employeeToEdit?.monthlySalary ?? '');
    const resolvedPaymentFrequency = formState.paymentFrequency || employeeToEdit?.paymentFrequency || 'monthly';
    const resolvedShiftStart = formState.shiftStart || employeeToEdit?.shiftStart || DEFAULT_SHIFT_START;
    const resolvedShiftEnd = formState.shiftEnd || employeeToEdit?.shiftEnd || DEFAULT_SHIFT_END;

    if (!resolvedName || !resolvedExpectedHours || !resolvedMonthlyHolidays || !resolvedMonthlySalary) {
      Alert.alert('Validation', 'Complete every required field.');
      return;
    }

    const employeePayload = {
      name: resolvedName,
      expectedHoursPerDay: Number(resolvedExpectedHours),
      monthlyHolidays: clampMonthlyHolidays(resolvedMonthlyHolidays),
      shiftStart: resolvedShiftStart,
      shiftEnd: resolvedShiftEnd,
      compensationAmount: Number(resolvedMonthlySalary),
      monthlySalary: convertCompensation(Number(resolvedMonthlySalary), resolvedPaymentFrequency, 'monthly'),
      paymentFrequency: resolvedPaymentFrequency,
    };

    if (isEditMode) {
      updateEmployee(employeeToEdit.id, employeePayload);
    } else {
      addEmployee(employeePayload);
    }

    try {
      await AsyncStorage.removeItem(draftStorageKey);
    } catch (error) {
      // Ignore draft cleanup failures after a successful save.
    }

    isDirtyRef.current = false;
    navigation.goBack();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <SectionCard style={styles.section}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <FormField
            label="Name"
            value={formState.name}
            onChangeText={(value) => updateField('name', value)}
            placeholder="Ravi"
          />
        </SectionCard>

        <SectionCard style={styles.section}>
          <Text style={styles.sectionTitle}>Schedule</Text>
          <FormField
            label="Hours / day"
            value={formState.expectedHours}
            onChangeText={(value) => updateField('expectedHours', value)}
            placeholder="8"
            keyboardType="numeric"
          />
          <FormField
            label="Monthly holidays"
            value={formState.monthlyHolidays}
            onChangeText={(value) => updateField('monthlyHolidays', value)}
            placeholder="4"
            keyboardType="numeric"
            style={styles.fieldSpacing}
          />
          <Text style={styles.helperText}>Employee can use these paid holidays on any day of the month.</Text>

          <View style={[styles.timeRow, styles.fieldSpacing]}>
            <View style={styles.timeColumn}>
              <Text style={styles.fieldLabel}>Shift start</Text>
              <Pressable style={styles.timeButton} onPress={() => openTimePicker('shiftStart')}>
                <Text style={[styles.timeText, !formState.shiftStart && styles.timePlaceholder]}>
                  {formState.shiftStart ? dayjs(`2000-01-01 ${formState.shiftStart}`).format('hh:mm A') : 'Select'}
                </Text>
              </Pressable>
            </View>
            <View style={[styles.timeColumn, styles.timeColumnGap]}>
              <Text style={styles.fieldLabel}>Shift end</Text>
              <Pressable style={styles.timeButton} onPress={() => openTimePicker('shiftEnd')}>
                <Text style={[styles.timeText, !formState.shiftEnd && styles.timePlaceholder]}>
                  {formState.shiftEnd ? dayjs(`2000-01-01 ${formState.shiftEnd}`).format('hh:mm A') : 'Select'}
                </Text>
              </Pressable>
            </View>
          </View>
        </SectionCard>

        <SectionCard style={styles.section} tinted>
          <Text style={styles.sectionTitle}>Compensation</Text>
          <FormField
            label={getCompensationLabel(formState.paymentFrequency)}
            value={formState.monthlySalary}
            onChangeText={(value) => updateField('monthlySalary', value)}
            placeholder={formState.paymentFrequency === 'weekly' ? '12000' : '50000'}
            keyboardType="numeric"
          />
          <Text style={styles.helperText}>
            {formState.paymentFrequency === 'weekly'
              ? 'Enter the amount paid for one week.'
              : 'Enter the amount paid for one month.'}
          </Text>
          <View style={styles.fieldSpacing}>
            <Text style={styles.fieldLabel}>Payment frequency</Text>
            <View style={styles.frequencyWrap}>
              {PAYMENT_FREQUENCY_OPTIONS.map((option) => {
                const selected = formState.paymentFrequency === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => handlePaymentFrequencyChange(option.value)}
                    style={({ pressed }) => [
                      styles.frequencyChip,
                      selected && styles.frequencyChipSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.frequencyText, selected && styles.frequencyTextSelected]}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SectionCard>

        <PrimaryButton
          label={isEditMode ? 'Update employee' : 'Save employee'}
          onPress={handleSave}
          disabled={!draftReady || (!isEditMode && !allFieldsFilled)}
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
  helperText: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 13,
  },
  frequencyWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  frequencyChip: {
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
  frequencyChipSelected: {
    backgroundColor: colors.accentStrong,
    borderColor: colors.accentStrong,
  },
  frequencyText: {
    color: colors.text,
    fontWeight: '700',
  },
  frequencyTextSelected: {
    color: colors.white,
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
    backgroundColor: 'rgba(34, 31, 26, 0.24)',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: 18,
    paddingTop: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  modalAction: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  modalActionText: {
    color: colors.accentStrong,
    fontWeight: '700',
    fontSize: 16,
  },
  pressed: {
    opacity: 0.82,
  },
});

export default AddEmployeeScreen;
