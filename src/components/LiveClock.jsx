import { useState, useEffect } from 'react';
import { getRelativeDate } from '../utils/dateUtils';

const LiveClock = () => {
  const [currentTime, setCurrentTime] = useState(getRelativeDate(0));

  useEffect(() => {
    // Set up an interval to update the time every second
    const timer = setInterval(() => {
      setCurrentTime(getRelativeDate(0));
    }, 1000);

    // Clean up the interval when the component unmounts to prevent memory leaks
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-end">
      <div className="text-2xl font-extrabold text-brand-navy tabular-nums">
        {currentTime.time}
      </div>
      <div className="text-[10px] font-bold text-brand-teal uppercase tracking-widest">
        {currentTime.fullDate}
      </div>
    </div>
  );
};

export default LiveClock;