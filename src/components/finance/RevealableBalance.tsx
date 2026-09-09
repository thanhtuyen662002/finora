'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { maskFinancialValue, useBalanceVisibility } from '@/features/preferences';

export interface RevealableBalanceProps {
  value: string;
  className?: string;
  ariaLabel?: string;
}

/**
 * Renders a balance that follows the global privacy setting while allowing a
 * deliberate, local reveal. Revealing never changes the persisted setting and
 * is reset when the setting changes or the component unmounts.
 */
export function RevealableBalance({
  value,
  className,
  ariaLabel = 'Số tiền',
}: RevealableBalanceProps) {
  const { maskBalance } = useBalanceVisibility();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [maskBalance]);

  if (!maskBalance) {
    return <span className={className}>{value}</span>;
  }

  const displayValue = maskFinancialValue(value, !revealed);
  const stateLabel = revealed ? 'đang hiển thị' : 'đang được che';

  return (
    <button
      type="button"
      className={cn(
        'm-0 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left font-inherit text-inherit transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
        className
      )}
      onClick={(event) => {
        event.stopPropagation();
        setRevealed((current) => !current);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        setRevealed(true);
      }}
      aria-label={`${ariaLabel}, ${stateLabel}. Nhấn để ${revealed ? 'che' : 'hiện'} số tiền`}
      title={`Nhấn để ${revealed ? 'che' : 'hiện'} số tiền`}
    >
      {displayValue}
    </button>
  );
}
