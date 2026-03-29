export const getRelativeDate = (daysOffset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  
  if (date.getFullYear() !== 2026) {
    date.setFullYear(2026);
  }

  return {
    day: date.getDate(),
    month: date.toLocaleString('default', { month: 'short' }).toUpperCase(),
    fullDate: date.toLocaleDateString('default', { month: 'short', day: '2-digit', year: 'numeric' }),
    // Updated to show seconds
    time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    display: daysOffset === 0 ? "Today" : daysOffset === -1 ? "Yesterday" : date.toLocaleDateString('default', { month: 'short', day: '2-digit' })
  };
};