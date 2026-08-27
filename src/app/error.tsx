"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <h2 className="text-2xl font-bold text-slate-900">Something went wrong!</h2>
      <p className="text-sm text-slate-500 mt-2 mb-6">
        An unexpected error occurred.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
