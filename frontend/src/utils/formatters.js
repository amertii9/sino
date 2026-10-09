export const formatCurrency = (amount, currency = 'ETB') => {
  if (amount === undefined || amount === null || isNaN(amount)) return `0 ${currency}`;
  return `${new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(amount)} ${currency}`;
};

export const formatNumber = (num, decimals = 1) => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
  }).format(num);
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

export const exportToCSV = (filename, data, headers) => {
  if (!data || !data.length) {
    alert('No data to export');
    return;
  }

  const csvRows = [];
  csvRows.push(headers.map(h => `"${h.label}"`).join(','));

  data.forEach(item => {
    const values = headers.map(h => {
      let val = item[h.key];
      if (typeof h.format === 'function') {
        val = h.format(val, item);
      }
      if (val === undefined || val === null) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(','));
  });

  const csvString = csvRows.join('\r\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
