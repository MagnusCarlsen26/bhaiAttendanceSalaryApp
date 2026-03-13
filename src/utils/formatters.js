const currencyFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const currencyFormatterNoPaise = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatCurrency = (value) => {
  if (typeof value !== 'number') {
    value = Number(value) || 0;
  }
  const absValue = Math.abs(value);
  const formatted = currencyFormatter.format(absValue);
  return `${value < 0 ? '-₹' : '₹'}${formatted}`;
};

export const formatCurrencyNoPaise = (value) => {
  if (typeof value !== 'number') {
    value = Number(value) || 0;
  }
  const absValue = Math.abs(value);
  const formatted = currencyFormatterNoPaise.format(absValue);
  return `${value < 0 ? '-₹' : '₹'}${formatted}`;
};

export const formatHours = (value) => {
  if (value === undefined || value === null) {
    return '0.0h';
  }
  const formatted = value.toFixed(1);
  return value > 0 ? `+${formatted}h` : `${formatted}h`;
};

export const formatCurrencyInK = (value) => {
  if (typeof value !== 'number') {
    value = Number(value) || 0;
  }
  const absValue = Math.abs(value);
  const flooredThousands = Math.floor((absValue / 1000) * 10) / 10;
  return `${value < 0 ? '-₹' : '₹'}${flooredThousands.toFixed(1)} K`;
};
