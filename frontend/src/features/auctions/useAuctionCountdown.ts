import { useEffect, useState } from "react";
import { remainingSeconds } from "./auction";

export function useAuctionCountdown(endsAt: number) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= endsAt) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  return { now, remaining: remainingSeconds(endsAt, now) };
}
