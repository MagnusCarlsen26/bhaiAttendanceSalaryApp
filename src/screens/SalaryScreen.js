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
import Screen from '../components/ui/Screen';
import SectionCard from '../components/ui/SectionCard';
import EmptyState from '../components/ui/EmptyState';
import PrimaryButton from '../components/ui/PrimaryButton';
import { colors, radius, type } from '../theme/tokens';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const getPayoutSummary = (payoutStatus) => {
  const payments = Array.isArray(payoutStatus?.payments) ? payoutStatus.payments : [];
  if (payments.length === 0) {
    return null;
  }

  const totalPaid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const fullSalaryPaid = payments.some((payment) => payment.status === 'salary_paid');
  const advancePaid = payments
    .filter((payment) => payment.status === 'advance_paid')
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);

  return {
    totalPaid,
    fullSalaryPaid,
    advancePaid,
    latestPaidAt: payments[payments.length - 1]?.updatedAt || null,
    payments,
  };
};

const formatPaymentDate = (value) => {
  if (!value) {
    return '';
  }
  return dayjs(value).format('DD MMM YYYY');
};

const getRemainingSalary = (netAmount, payoutStatus) => {
  const paidAmount = Array.isArray(payoutStatus?.payments)
    ? payoutStatus.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
    : 0;
  return Math.max((Number(netAmount) || 0) - paidAmount, 0);
};

const SalaryScreen = () => {
  const navigation = useNavigation();
  const { employees, getSalaryBreakdown, getPayoutStatus, setPayoutStatus, clearPayoutStatus, refreshData } = useAttendance();
  const currentMonth = useMemo(() => dayjs().startOf('month'), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.format('YYYY-MM-DD'));
  const [expandedId, setExpandedId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPayoutTypeByEmployee, setSelectedPayoutTypeByEmployee] = useState({});
  const [advanceInputs, setAdvanceInputs] = useState({});
  const [monthPickerConfig, setMonthPickerConfig] = useState(null);

  const selectedMonthDate = useMemo(() => dayjs(selectedMonth).startOf('month'), [selectedMonth]);
  const monthRange = useMemo(
    () => ({
      start: selectedMonthDate.startOf('month'),
      end: selectedMonthDate.endOf('month'),
    }),
    [selectedMonthDate]
  );
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

  const totalSalary = useMemo(
    () =>
      employees.reduce((sum, employee) => {
        const breakdown = getSalaryBreakdown(employee.id, monthRange.start, monthRange.end);
        const payoutStatus = getPayoutStatus(employee.id, monthRange.start);
        return sum + getRemainingSalary(breakdown?.net || 0, payoutStatus);
      }, 0),
    [employees, getPayoutStatus, getSalaryBreakdown, monthRange]
  );

  const totalMonthlySalary = useMemo(
    () => employees.reduce((sum, employee) => sum + (Number(employee.monthlySalary) || 0), 0),
    [employees]
  );

  const rows = useMemo(
    () =>
      employees.map((employee) => ({
        employee,
        breakdown: getSalaryBreakdown(employee.id, monthRange.start, monthRange.end),
        payoutStatus: getPayoutStatus(employee.id, monthRange.start),
      })),
    [employees, getPayoutStatus, getSalaryBreakdown, monthRange]
  );

  useEffect(() => {
    setAdvanceInputs((prev) => {
      const next = { ...prev };
      let changed = false;

      rows.forEach(({ employee, payoutStatus }) => {
        if (next[employee.id] !== undefined) {
          return;
        }
        const latestAdvancePayment = Array.isArray(payoutStatus?.payments)
          ? [...payoutStatus.payments].reverse().find((payment) => payment.status === 'advance_paid')
          : null;
        if (latestAdvancePayment) {
          next[employee.id] = String(Number(latestAdvancePayment.amount) || '');
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [rows]);

  const handleRowPress = (employeeId) => {
    setExpandedId((prev) => (prev === employeeId ? null : employeeId));
  };

  const handleMarkSalaryPaid = (employee, amount) => {
    Alert.alert('Confirm payout', `Confirm ${employee.name}'s salary paid?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          setPayoutStatus(employee.id, 'salary_paid', monthRange.start, amount);
        },
      },
    ]);
  };

  const handleMarkAdvancePaid = (employee, amount) => {
    Alert.alert('Confirm payout', `Confirm ${employee.name}'s advance salary paid: ${formatCurrencyNoPaise(amount)}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          setPayoutStatus(employee.id, 'advance_paid', monthRange.start, amount);
        },
      },
    ]);
  };

  const handleClearPayout = (employee) => {
    Alert.alert('Delete payout status', `Remove saved payout info for ${employee.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          clearPayoutStatus(employee.id, monthRange.start);
        },
      },
    ]);
  };

  const renderItem = ({ item }) => {
    const isExpanded = expandedId === item.employee.id;
    const breakdown = item.breakdown;
    const payoutSummary = getPayoutSummary(item.payoutStatus);
    const hasFullSalaryPayment = payoutSummary?.fullSalaryPaid;
    const selectedPayoutType = selectedPayoutTypeByEmployee[item.employee.id] || 'none';
    const advanceInput = advanceInputs[item.employee.id] ?? '';
    const advanceAmount = Number(advanceInput);
    const isAdvanceAmountValid = Number.isFinite(advanceAmount) && advanceAmount > 0;
    const bonusHours = breakdown?.extraHours > 0 ? breakdown.extraHours : 0;
    const lessHours = breakdown?.extraHours < 0 ? Math.abs(breakdown.extraHours) : 0;
    const salaryAmount = Math.max(breakdown?.net || 0, 0);
    const remainingSalaryAmount = getRemainingSalary(salaryAmount, item.payoutStatus);

    return (
      <SectionCard style={styles.rowCard}>
        <Pressable onPress={() => handleRowPress(item.employee.id)}>
          <View style={styles.rowHeader}>
            <View>
              <Text style={styles.rowName}>{item.employee.name}</Text>
              {payoutSummary ? (
                <Text style={styles.rowSubtext}>
                  Paid: {formatCurrencyNoPaise(payoutSummary.totalPaid)} on {formatPaymentDate(payoutSummary.latestPaidAt)}
                </Text>
              ) : null}
            </View>
            <View style={styles.rowValueWrap}>
              <Text style={styles.rowValue}>{formatCurrencyNoPaise(remainingSalaryAmount)}</Text>
            </View>
          </View>
        </Pressable>

        {isExpanded ? (
          <View style={styles.breakdownWrap}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Monthly salary</Text>
              <Text style={styles.breakdownValue}>{formatCurrencyNoPaise(item.employee.monthlySalary)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Present days</Text>
              <Text style={styles.breakdownValue}>
                {breakdown?.presentDays || 0} / {breakdown?.workingDays || 0}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Deserved salary</Text>
              <Text style={styles.breakdownValue}>{formatCurrencyNoPaise(breakdown?.earnedBase || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Absent deduction</Text>
              <Text style={[styles.breakdownValue, styles.negativeValue]}>
                {formatCurrencyNoPaise(-(breakdown?.absentDeduction || 0))}
              </Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Bonus ( {formatHours(bonusHours)} )</Text>
              <Text style={[styles.breakdownValue, styles.positiveValue]}>{formatCurrencyNoPaise(breakdown?.bonus || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Less ( {formatHours(lessHours)} )</Text>
              <Text style={[styles.breakdownValue, styles.negativeValue]}>{formatCurrencyNoPaise(-(breakdown?.less || 0))}</Text>
            </View>
            {payoutSummary?.fullSalaryPaid ? (
              <View style={[styles.breakdownRow, styles.paymentSectionStart]}>
                <Text style={styles.breakdownLabel}>Salary paid</Text>
                <View style={styles.breakdownValueGroup}>
                  <Text style={[styles.breakdownValue, styles.positiveValue]}>
                    {formatCurrencyNoPaise(
                      payoutSummary.payments
                        .filter((payment) => payment.status === 'salary_paid')
                        .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
                    )}
                  </Text>
                  <Text style={styles.breakdownDate}>
                    {formatPaymentDate(
                      [...payoutSummary.payments].reverse().find((payment) => payment.status === 'salary_paid')?.updatedAt
                    )}
                  </Text>
                </View>
              </View>
            ) : null}
            {!payoutSummary?.fullSalaryPaid && payoutSummary?.advancePaid ? (
              <View style={[styles.breakdownRow, styles.paymentSectionStart]}>
                <Text style={styles.breakdownLabel}>Advance paid</Text>
                <View style={styles.breakdownValueGroup}>
                  <Text style={[styles.breakdownValue, styles.advanceValue]}>{formatCurrencyNoPaise(payoutSummary.advancePaid)}</Text>
                  <Text style={styles.breakdownDate}>
                    {formatPaymentDate(
                      [...payoutSummary.payments].reverse().find((payment) => payment.status === 'advance_paid')?.updatedAt
                    )}
                  </Text>
                </View>
              </View>
            ) : null}
            {payoutSummary?.fullSalaryPaid && payoutSummary?.advancePaid ? (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Advance paid</Text>
                <View style={styles.breakdownValueGroup}>
                  <Text style={[styles.breakdownValue, styles.advanceValue]}>{formatCurrencyNoPaise(payoutSummary.advancePaid)}</Text>
                  <Text style={styles.breakdownDate}>
                    {formatPaymentDate(
                      [...payoutSummary.payments].reverse().find((payment) => payment.status === 'advance_paid')?.updatedAt
                    )}
                  </Text>
                </View>
              </View>
            ) : null}
            {payoutSummary ? (
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Total paid</Text>
                <View style={styles.breakdownValueGroup}>
                  <Text style={[styles.breakdownValue, styles.advanceValue]}>{formatCurrencyNoPaise(payoutSummary.totalPaid)}</Text>
                  <Text style={styles.breakdownDate}>{formatPaymentDate(payoutSummary.latestPaidAt)}</Text>
                </View>
              </View>
            ) : null}
            <View style={[styles.breakdownRow, styles.breakdownTotal]}>
              <Text style={styles.totalLabel}>Remaining net</Text>
              <Text style={styles.totalValue}>{formatCurrencyNoPaise(remainingSalaryAmount)}</Text>
            </View>

            <View style={styles.actionsWrap}>
              <Text style={styles.actionsTitle}>Update payout</Text>
              <View style={styles.topLevelActionRow}>
                <Pressable
                  onPress={() =>
                    setSelectedPayoutTypeByEmployee((prev) => ({
                      ...prev,
                      [item.employee.id]:
                        selectedPayoutType === 'salary_paid' ? 'none' : 'salary_paid',
                    }))
                  }
                  style={[
                    styles.dropdownButton,
                    selectedPayoutType === 'salary_paid' && styles.dropdownButtonActive,
                    hasFullSalaryPayment && styles.dropdownButtonDisabled,
                  ]}
                  disabled={hasFullSalaryPayment}
                >
                  <Text
                    style={[
                      styles.dropdownButtonText,
                      selectedPayoutType === 'salary_paid' && styles.dropdownButtonTextActive,
                      hasFullSalaryPayment && styles.dropdownButtonTextDisabled,
                    ]}
                  >
                    Salary paid
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setSelectedPayoutTypeByEmployee((prev) => ({
                      ...prev,
                      [item.employee.id]:
                        selectedPayoutType === 'advance_paid' ? 'none' : 'advance_paid',
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
                  label={`Mark Salary Paid (${formatCurrencyNoPaise(salaryAmount)})`}
                  onPress={() => handleMarkSalaryPaid(item.employee, salaryAmount)}
                  style={styles.actionButton}
                  disabled={hasFullSalaryPayment || salaryAmount <= 0}
                />
              ) : null}

              {selectedPayoutType === 'advance_paid' ? (
                <View style={styles.advanceWrap}>
                  <Text style={styles.advanceLabel}>Advance amount</Text>
                  <TextInput
                    value={advanceInput}
                    onChangeText={(value) => setAdvanceInputs((prev) => ({ ...prev, [item.employee.id]: value }))}
                    placeholder="Enter advance amount"
                    placeholderTextColor={colors.textSoft}
                    keyboardType="numeric"
                    style={styles.advanceInput}
                  />
                  <PrimaryButton
                    label="Mark Advance Paid"
                    onPress={() => handleMarkAdvancePaid(item.employee, advanceAmount)}
                    disabled={!isAdvanceAmountValid}
                    style={styles.actionButton}
                  />
                </View>
              ) : null}

              {payoutSummary ? (
                <Pressable onPress={() => handleClearPayout(item.employee)} style={styles.clearButton}>
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
          <Text style={styles.heroLabel}>Total payout</Text>
          <Text style={styles.heroValue}>{formatCurrencyNoPaise(totalSalary)}</Text>
          <Text style={styles.heroSubtext}>
            {heroMonthLabel} monthly salary total: {formatCurrencyNoPaise(totalMonthlySalary)}
          </Text>
        </SectionCard>

        <FlatList
          data={rows}
          renderItem={renderItem}
          keyExtractor={(item) => item.employee.id}
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
    alignItems: 'center',
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
  rowValueWrap: {
    marginLeft: 12,
    alignItems: 'flex-end',
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
  },
  breakdownLabel: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  breakdownValue: {
    color: colors.text,
    fontWeight: '700',
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
