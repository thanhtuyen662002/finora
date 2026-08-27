"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center p-6 text-center font-sans">
        <h2 className="text-2xl font-bold text-slate-900">Critical Error</h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          A critical application error occurred.
        </p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm font-medium"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
