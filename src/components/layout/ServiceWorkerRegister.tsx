"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js in production builds only. In development the worker would
 * cache hot-reloaded chunks and get in the way, so any earlier registration is
 * removed instead.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => registrations.forEach((registration) => registration.unregister()))
        .catch(() => {});
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Installability is optional; the app works fully without the worker.
      });
  }, []);

  return null;
}
