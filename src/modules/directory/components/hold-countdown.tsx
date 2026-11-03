"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * The time left to pay, or for the host to answer. The server says how many seconds are left when it draws the page
 * and the browser counts down from there, so a phone with the wrong clock still shows the right time. Under an hour
 * it is minutes and seconds (09:41); over an hour, hours and minutes. When it reaches zero it says so, and asks the
 * page to look again (`onElapsed`), because the booking has probably just ended.
 */
export function HoldCountdown({
  remainingSeconds,
  onElapsed,
}: {
  remainingSeconds: number;
  onElapsed?: () => void;
}) {
  const t = useTranslations("confirmation");
  const [left, setLeft] = useState(Math.max(0, Math.floor(remainingSeconds)));

  // A newer answer from the server (the page was refreshed) restarts the count from it.
  useEffect(() => {
    setLeft(Math.max(0, Math.floor(remainingSeconds)));
  }, [remainingSeconds]);

  useEffect(() => {
    if (left <= 0) {
      onElapsed?.();
      return;
    }
    const timer = setTimeout(() => setLeft((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, onElapsed]);

  if (left <= 0) return <span className="font-semibold">{t("holdOver")}</span>;
  const hours = Math.floor(left / 3600);
  const minutes = Math.floor((left % 3600) / 60);
  return (
    <span className="font-semibold tabular-nums" role="timer">
      {hours > 0 ? t("holdLeft", { hours, minutes }) : `${pad(minutes)}:${pad(left % 60)}`}
    </span>
  );
}
