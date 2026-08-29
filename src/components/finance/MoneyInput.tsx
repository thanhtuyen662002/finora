"use client";

import React, { useRef, useId } from 'react';
import { cn } from '@/lib/utils';
import {
  formatMoneyInputDisplay,
  parseMoneyInputValue,
  isZeroDecimalCurrency,
} from '@/lib/money';

export interface MoneyInputProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (rawValue: string) => void;
  currencyCode?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  'aria-label'?: string;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      id: customId,
      name,
      value,
      onChange,
      currencyCode = 'VND',
      placeholder,
      className,
      disabled,
      required,
      autoFocus,
      prefix,
      suffix,
      'aria-label': ariaLabel,
    },
    forwardedRef
  ) => {
    const generatedId = useId();
    const inputId = customId || generatedId;
    const innerRef = useRef<HTMLInputElement>(null);
    const inputRef = (forwardedRef as React.RefObject<HTMLInputElement>) || innerRef;

    const isZeroDecimal = isZeroDecimalCurrency(currencyCode);
    const displayValue = formatMoneyInputDisplay(value, currencyCode);

    const defaultPlaceholder = isZeroDecimal ? '0' : '0.00';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const rawText = input.value;
      const cursorPos = input.selectionStart ?? rawText.length;

      if (currencyCode.toUpperCase() === 'VND') {
        // Count integer digits typed before cursor
        const digitsBeforeCursor = rawText.slice(0, cursorPos).replace(/\D/g, '').length;
        const parsed = parseMoneyInputValue(rawText, 'VND');
        onChange(parsed);

        // Maintain cursor position in formatted string
        requestAnimationFrame(() => {
          if (!inputRef.current) return;
          const formatted = formatMoneyInputDisplay(parsed, 'VND');
          let targetPos = 0;
          let countedDigits = 0;
          for (let i = 0; i < formatted.length; i++) {
            if (/\d/.test(formatted[i])) {
              countedDigits++;
            }
            if (countedDigits === digitsBeforeCursor) {
              targetPos = i + 1;
              break;
            }
          }
          if (countedDigits < digitsBeforeCursor || digitsBeforeCursor === 0) {
            targetPos = digitsBeforeCursor === 0 ? 0 : formatted.length;
          }
          inputRef.current.setSelectionRange(targetPos, targetPos);
        });
      } else {
        const parsed = parseMoneyInputValue(rawText, currencyCode);
        onChange(parsed);
      }
    };

    return (
      <div className="relative flex items-center w-full">
        {prefix && (
          <div className="absolute left-3 flex items-center pointer-events-none text-muted-foreground text-sm font-medium">
            {prefix}
          </div>
        )}
        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          inputMode={isZeroDecimal ? 'numeric' : 'decimal'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={displayValue}
          onChange={handleChange}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          required={required}
          autoFocus={autoFocus}
          aria-label={ariaLabel || `Số tiền (${currencyCode})`}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-2xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
            prefix ? 'pl-8' : '',
            suffix ? 'pr-12' : '',
            className
          )}
        />
        {suffix && (
          <div className="absolute right-3 flex items-center pointer-events-none text-muted-foreground text-xs font-semibold uppercase">
            {suffix}
          </div>
        )}
      </div>
    );
  }
);

MoneyInput.displayName = 'MoneyInput';
