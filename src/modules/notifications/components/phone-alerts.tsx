"use client";

import { Bell, BellOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { useAction } from "@/hooks/use-action";
import { api } from "@/lib/api-client";

type PushState = "checking" | "on" | "off" | "blocked" | "unsupported" | "needsInstall";

const PUSH_API = "/api/me/push";

/** iPhone and iPad, including iPads that report themselves as a Mac. */
const isAppleMobile = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches;

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/** What this device can do. iPhones only allow push from the app on the Home Screen, so Safari in a tab says so. */
async function detect(): Promise<PushState> {
  if (isAppleMobile() && !isStandalone()) return "needsInstall";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return (await currentSubscription()) ? "on" : "off";
}

/**
 * Push notifications on this device, for the signed-in person: turn them on (the browser asks for permission, then the
 * device is saved for them) or off. Shown only when the server has push set up (`publicKey`). On a booking's page
 * (`forBooking`) it speaks of that booking; everywhere else of every update the person gets.
 */
export function PhoneAlerts({ publicKey, forBooking = false }: { publicKey: string; forBooking?: boolean }) {
  const t = useTranslations("pwa");
  const { run, pending, error } = useAction();
  const [state, setState] = useState<PushState>("checking");

  useEffect(() => {
    detect().then(setState, () => setState("unsupported"));
  }, []);

  const turnOn = () =>
    void run(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey),
        }));
      await api.post(PUSH_API, subscription.toJSON());
      setState("on");
    });

  const turnOff = () =>
    void run(async () => {
      const subscription = await currentSubscription();
      if (subscription) {
        await api.delete(PUSH_API, { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
    });

  return (
    <section className="rounded-2xl p-6 ring-1 ring-line">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="size-5 text-accent" aria-hidden />
        {forBooking ? t("bookingTitle") : t("title")}
      </h2>
      <p className="mt-2 max-w-prose text-sm text-muted">
        {forBooking ? t("bookingBody") : t("accountBody")}
      </p>
      <div className="mt-5 flex min-h-11 flex-wrap items-center gap-3">
        {state === "off" && (
          <button type="button" disabled={pending} onClick={turnOn} className={buttonClass()}>
            <Bell className="size-4" aria-hidden />
            {t("turnOn")}
          </button>
        )}
        {state === "on" && (
          <>
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
              <Bell className="size-4" aria-hidden />
              {t("on")}
            </p>
            <button
              type="button"
              disabled={pending}
              onClick={turnOff}
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              <BellOff className="size-4" aria-hidden />
              {t("turnOff")}
            </button>
          </>
        )}
        {(state === "blocked" || state === "unsupported" || state === "needsInstall") && (
          <p className="max-w-prose text-sm font-semibold">{t(state)}</p>
        )}
      </div>
      <FormError message={error} className="mt-3" />
    </section>
  );
}
