"use client";

import { useEffect } from "react";
import { startForegroundPushListener } from "@/lib/push-notifications";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    void startForegroundPushListener();
  }, []);

  return null;
}
