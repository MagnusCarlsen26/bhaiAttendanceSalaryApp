import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import dayjs from 'dayjs';
import { useNavigation } from '@react-navigation/native';
import { useAttendance } from '../context/AttendanceContext';
import { formatCurrencyNoPaise, formatHours } from '../utils/formatters';
import { getCompensationLabel, getCycleCompensationLabel } from '../utils/payroll';
import Screen from '../components/ui/Screen';
import SectionCard from '../components/ui/SectionCard';
import EmptyState from '../components/ui/EmptyState';
import PrimaryButton from '../components/ui/PrimaryButton';
import { colors, radius, type } from '../theme/tokens';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatPaymentDate = (value) => {
  if (!value) {
    return '';
  }
  return dayjs(value).format('DD MMM YYYY');
};

const formatCycleRange = (start, end) => `${dayjs(start).format('DD MMM')} - ${dayjs(end).format('DD MMM')}`;

const SalaryScreen = () => {
  const navigation = useNavigation();
  const {
    employees,
    getPayCyclesForEmployee,
    setPayoutStatus,
    clearPayoutStatus,
    refreshData,
  } = useAttendance();
  const currentMonth = useMemo(() => dayjs().startOf('month'), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.format('YYYY-MM-DD'));
  const [expandedId, setExpandedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayoutTypeByCycle, setSelectedPayoutTypeByCycle] = useState({});
  const [advanceInputs, setAdvanceInputs] = useState({});
  const [monthPickerConfig, setMonthPickerConfig] = useState(null);

  const selectedMonthDate = useMemo(() => dayjs(selectedMonth).startOf('month'), [selectedMonth]);
  const headerMonthLabel = useMemo(() => selectedMonthDate.format('MMM YYYY'), [selectedMonthDate]);
  const heroMonthLabel = useMemo(() => selectedMonthDate.format('MMMM YYYY'), [selectedMonthDate]);
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

  const rows = useMemo(
    () =>
      employees
        .flatMap((employee) => getPayCyclesForEmployee(employee.id, selectedMonthDate))
        .sort((a, b) => {
          const paidDiff = Number(a.status.key === 'paid') - Number(b.status.key === 'paid');
          if (paidDiff !== 0) {
            return paidDiff;
          }
          const dueDiff = a.dueDate.valueOf() - b.dueDate.valueOf();
          if (dueDiff !== 0) {
            return dueDiff;
          }
          return a.employee.name.localeCompare(b.employee.name);
        }),
    [employees, getPayCyclesForEmployee, selectedMonthDate]
  );

  const totalRemaining = useMemo(
    () => rows.reduce((sum, row) => sum + (row.remainingAmount || 0), 0),
    [rows]
  );

  const totalScheduled = useMemo(
    () => rows.reduce((sum, row) => sum + (row.breakdown?.baseCompensation || 0), 0),
    [rows]
  );

  useEffect(() => {
    setAdvanceInputs((prev) => {
      const next = { ...prev };
      let changed = false;

      rows.forEach((row) => {
        const rowId = `${row.employee.id}:${row.cycleKey}`;
        const latestAdvancePayment = row.payoutSummary?.payments
          ? [...row.payoutSummary.payments].reverse().find((payment) => payment.status === 'advance_paid')
          : null;
        if (latestAdvancePayment && next[rowId] === undefined) {
          next[rowId] = String(Number(latestAdvancePayment.amount) || '');
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [rows]);

  const handleRowPress = (rowId) => {
    setExpandedId((prev) => (prev === rowId ? null : rowId));
  };

  const handleMarkSalaryPaid = (row, amount) => {
    Alert.alert('Confirm payout', `Confirm ${row.employee.name}'s payout as paid?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          setPayoutStatus(row.employee.id, 'salary_paid', row.cycleKey, amount, row.employee.paymentFrequency, row.dueDate);
        },
      },
    ]);
  };

  const handleMarkAdvancePaid = (row, amount) => {
    Alert.alert('Confirm payout', `Confirm ${row.employee.name}'s advance paid: ${formatCurrencyNoPaise(amount)}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          setPayoutStatus(row.employee.id, 'advance_paid', row.cycleKey, amount, row.employee.paymentFrequency, row.dueDate);
        },
      },
    ]);
  };

  const handleClearPayout = (row) => {
    Alert.alert('Delete payout status', `Remove saved payout info for ${row.employee.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          clearPayoutStatus(row.employee.id, row.cycleKey, row.employee.paymentFrequency, row.dueDate);
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const rowId = `${item.employee.id}:${item.cycleKey}`;
    const isExpanded = expandedId === rowId;
    const selectedPayoutType = selectedPayoutTypeByCycle[rowId] || 'none';
    const advanceInput = advanceInputs[rowId] ?? '';
    const advanceAmount = Number(advanceInput);
    const isAdvanceAmountValid = Number.isFinite(advanceAmount) && advanceAmount > 0;
    const breakdown = item.breakdown;
    const salaryAmount = Math.max(breakdown?.net || 0, 0);
    const payoutSummary = item.payoutSummary;
    const hasFullPayment = item.status.key === 'paid';
    const bonusHours = breakdown?.extraHours > 0 ? breakdown.extraHours : 0;
    const lessHours = breakdown?.extraHours < 0 ? Math.abs(breakdown.extraHours) : 0;

    return (
      <SectionCard style={styles.rowCard}>
        <Pressable onPress={() => handleRowPress(rowId)}>
          <View style={styles.rowHeader}>
            <View style={styles.rowHeaderText}>
              <Text style={styles.rowName}>{item.employee.name}</Text>
              <Text style={styles.rowSubtext}>
                {getCycleCompensationLabel(item.employee.paymentFrequency)}
              </Text>
              <Text style={styles.rowMeta}>{formatCycleRange(item.start, item.end)}</Text>
            </View>
            <View style={styles.rowValueWrap}>
              <Text style={styles.rowValue}>{formatCurrencyNoPaise(item.remainingAmount)}</Text>
            </View>
          </View>
        </Pressable>

        {isExpanded ? (
          <View style={styles.breakdownWrap}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>{getCompensationLabel(item.employee.paymentFrequency)}</Text>
              <Text style={styles.breakdownValue}>{formatCurrencyNoPaise(breakdown?.baseCompensation || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Cycle period</Text>
              <Text style={styles.breakdownValue}>{formatCycleRange(item.start, item.end)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Present days</Text>
              <Text style={styles.breakdownValue}>{breakdown?.presentDays || 0}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Leave deduction</Text>
              <View style={styles.breakdownValueGroup}>
                <Text style={[styles.breakdownValue, styles.negativeValue]}>
                  {formatCurrencyNoPaise(-(breakdown?.absentDeduction || 0))}
                </Text>
                <Text style={styles.breakdownDate}>{breakdown?.chargeableAbsentDays || 0} unpaid leave days</Text>
              </View>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Bonus ({formatHours(bonusHours)})</Text>
              <Text style={[styles.breakdownValue, styles.positiveValue]}>{formatCurrencyNoPaise(breakdown?.bonus || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Less ({formatHours(lessHours)})</Text>
              <Text style={[styles.breakdownValue, styles.negativeValue]}>{formatCurrencyNoPaise(-(breakdown?.less || 0))}</Text>
            </View>
            {payoutSummary ? (
              <View style={[styles.breakdownRow, styles.paymentSectionStart]}>
                <Text style={styles.breakdownLabel}>Total paid</Text>
                <View style={styles.breakdownValueGroup}>
                  <Text style={[styles.breakdownValue, styles.advanceValue]}>{formatCurrencyNoPaise(payoutSummary.totalPaid)}</Text>
                  <Text style={styles.breakdownDate}>{formatPaymentDate(payoutSummary.latestPaidAt)}</Text>
                </View>
              </View>
            ) : null}
            {payoutSummary?.advancePaid ? (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Advance paid</Text>
                <Text style={[styles.breakdownValue, styles.advanceValue]}>{formatCurrencyNoPaise(payoutSummary.advancePaid)}</Text>
              </View>
            ) : null}
            <View style={[styles.breakdownRow, styles.breakdownTotal]}>
              <Text style={styles.totalLabel}>Remaining net</Text>
              <Text style={styles.totalValue}>{formatCurrencyNoPaise(item.remainingAmount)}</Text>
            </View>

            <View style={styles.actionsWrap}>
              <Text style={styles.actionsTitle}>Update payout</Text>
              <View style={styles.topLevelActionRow}>
                <Pressable
                  onPress={() =>
                    setSelectedPayoutTypeByCycle((prev) => ({
                      ...prev,
                      [rowId]: selectedPayoutType === 'salary_paid' ? 'none' : 'salary_paid',
                    }))
                  }
                  style={[
                    styles.dropdownButton,
                    selectedPayoutType === 'salary_paid' && styles.dropdownButtonActive,
                    hasFullPayment && styles.dropdownButtonDisabled,
                  ]}
                  disabled={hasFullPayment}
                >
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      selectedPayoutType === 'salary_paid' && styles.dropdownButtonTextActive,
                      hasFullPayment && styles.dropdownButtonTextDisabled,
                    ]}
                  >
                    Salary paid
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setSelectedPayoutTypeByCycle((prev) => ({
                      ...prev,
                      [rowId]: selectedPayoutType === 'advance_paid' ? 'none' : 'advance_paid',
                    }))
                  }
                  style={[styles.dropdownButton, selectedPayoutType === 'advance_paid' && styles.dropdownButtonActive]}
                >
                  <Text style={[styles.dropdownButtonText, selectedPayoutType === 'advance_paid' && styles.dropdownButtonTextActive]}>
                    Advance paid
                  </Text>
                </Pressable>
              </View>

              {selectedPayoutType === 'salary_paid' ? (
                <PrimaryButton
                  label={`Mark Paid (${formatCurrencyNoPaise(salaryAmount)})`}
                  onPress={() => handleMarkSalaryPaid(item, salaryAmount)}
                  style={styles.actionButton}
                  disabled={hasFullPayment || salaryAmount <= 0}
                />
              ) : null}

              {selectedPayoutType === 'advance_paid' ? (
                <View style={styles.advanceWrap}>
                  <Text style={styles.advanceLabel}>Advance amount</Text>
                  <TextInput
                    value={advanceInput}
                    onChangeText={(value) => setAdvanceInputs((prev) => ({ ...prev, [rowId]: value }))}
                    placeholder="Enter advance amount"
                    placeholderTextColor={colors.textSoft}
                    keyboardType="numeric"
                    style={styles.advanceInput}
                  />
                  <PrimaryButton
                    label="Mark Advance Paid"
                    onPress={() => handleMarkAdvancePaid(item, advanceAmount)}
                    disabled={!isAdvanceAmountValid}
                    style={styles.actionButton}
                  />
                </View>
              ) : null}

              {payoutSummary ? (
                <Pressable onPress={() => handleClearPayout(item)} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>Delete saved payout status</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </SectionCard>
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <SectionCard tinted style={styles.heroCard}>
          <Text style={styles.heroLabel}>Total remaining payout</Text>
          <Text style={styles.heroValue}>{formatCurrencyNoPaise(totalRemaining)}</Text>
          <Text style={styles.heroSubtext}>
            {heroMonthLabel} scheduled payout: {formatCurrencyNoPaise(totalScheduled)}
          </Text>
        </SectionCard>

        <FlatList
          data={rows}
          renderItem={renderItem}
          keyExtractor={(item) => `${item.employee.id}:${item.cycleKey}`}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState title="No salary data yet" subtitle="Add employees to unlock payout view." />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        />
      </View>

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
  container: {
    flex: 1,
    paddingTop: 8,
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
  heroCard: {
    marginBottom: 18,
  },
  heroLabel: {
    ...type.eyebrow,
    color: colors.textMuted,
  },
  heroValue: {
    marginTop: 14,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    color: colors.accentStrong,
  },
  heroSubtext: {
    ...type.body,
    marginTop: 8,
  },
  listContent: {
    paddingBottom: 120,
  },
  rowCard: {
    padding: 16,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  rowName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  rowSubtext: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
  },
  rowMeta: {
    marginTop: 4,
    color: colors.textSoft,
    fontSize: 12,
    fontWeight: '600',
  },
  rowValueWrap: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.accentStrong,
    textAlign: 'right',
  },
  breakdownWrap: {
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    gap: 12,
  },
  breakdownLabel: {
    color: colors.textMuted,
    fontWeight: '600',
    flex: 1,
  },
  breakdownValue: {
    color: colors.text,
    fontWeight: '700',
    textAlign: 'right',
  },
  breakdownValueGroup: {
    alignItems: 'flex-end',
  },
  paymentSectionStart: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  breakdownDate: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
  },
  positiveValue: {
    color: colors.present,
  },
  advanceValue: {
    color: colors.accentStrong,
  },
  negativeValue: {
    color: colors.absent,
  },
  breakdownTotal: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  totalValue: {
    color: colors.accentStrong,
    fontWeight: '800',
    fontSize: 17,
  },
  actionsWrap: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  actionsTitle: {
    ...type.eyebrow,
    color: colors.textMuted,
  },
  actionButton: {
    minHeight: 48,
  },
  advanceWrap: {
    gap: 10,
  },
  advanceLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  topLevelActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dropdownButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dropdownButtonActive: {
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentSoft,
  },
  dropdownButtonDisabled: {
    opacity: 0.5,
  },
  dropdownButtonText: {
    color: colors.text,
    fontWeight: '700',
  },
  dropdownButtonTextActive: {
    color: colors.accentStrong,
  },
  dropdownButtonTextDisabled: {
    color: colors.textSoft,
  },
  advanceInput: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 16,
  },
  clearButton: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.absent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  clearButtonText: {
    color: colors.absent,
    fontWeight: '700',
  },
  separator: {
    height: 12,
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
  pressed: {
    opacity: 0.84,
  },
});

export default SalaryScreen;
