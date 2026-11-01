import { useEffect, useState } from "react";
import { remainingSeconds } from "./auction";

export function useAuctionCountdown(endsAt: number, offset = 0) {
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentTime = Date.now() + offset;
      setNow(currentTime);
      if (currentTime >= endsAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt, offset]);

  return { now, remaining: remainingSeconds(endsAt, now) };
}
