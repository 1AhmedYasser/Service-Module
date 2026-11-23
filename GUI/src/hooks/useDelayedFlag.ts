import { useEffect, useState } from 'react';

const useDelayedFlag = (flag: boolean, delay = 200): boolean => {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!flag) {
      setDelayed(false);
      return;
    }
    const timeout = setTimeout(() => setDelayed(true), delay);
    return () => clearTimeout(timeout);
  }, [flag, delay]);

  return delayed;
};

export default useDelayedFlag;
