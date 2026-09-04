'use client';

/**
 * Finora AI Feature Module — Natural Language Transaction Input & Draft Preview
 * Phase 12A — User Interface Component
 *
 * Invariants:
 * 1. ZERO Financial Mutation Authority:
 *    This component NEVER calls createTransaction or mutates database state.
 *    "Apply" only populates client form fields for user review and explicit saving.
 * 2. Bounded Input:
 *    Enforces max 300 characters for natural language prompt with counter.
 * 3. Graceful Failure:
 *    Failures display localized error alerts without obstructing manual entry.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Check,
  X,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import type { AccountRow, CategoryRow } from '@/types/database';
import type { IncomeSourceWithStreams } from '@/features/income-sources';
import { formatMoneyWithCode } from '@/lib/money';
import {
  parseTransactionDraftAction,
  type ParsedTransactionDraft,
  type TransactionDraftWarningCode,
} from '@/features/ai/transaction-draft';

export const WARNING_LABELS: Record<TransactionDraftWarningCode, string> = {
  TYPE_MISSING: 'Chưa rõ loại thu/chi',
  AMOUNT_MISSING: 'Chưa nhận diện được số tiền',
  AMOUNT_INVALID: 'Số tiền không hợp lệ',
  CURRENCY_INFERRED: 'Tiền tệ mặc định',
  CURRENCY_INVALID: 'Mã tiền tệ không hợp lệ',
  ACCOUNT_NOT_MATCHED: 'Chưa khớp tài khoản',
  ACCOUNT_CURRENCY_CONFLICT: 'Tài khoản khác loại tiền tệ yêu cầu',
  ACCOUNT_CANDIDATES_OMITTED: 'Quá nhiều tài khoản, vui lòng chọn thủ công',
  CATEGORY_NOT_MATCHED: 'Chưa khớp danh mục',
  CATEGORY_TYPE_CONFLICT: 'Danh mục không khớp loại thu/chi',
  CATEGORY_CANDIDATES_OMITTED: 'Quá nhiều danh mục, vui lòng chọn thủ công',
  DATE_MISSING: 'Chưa có ngày giao dịch',
  DATE_AMBIGUOUS: 'Ngày giao dịch chưa rõ ràng',
  DATE_YEAR_INFERRED: 'Năm được suy đoán tự động',
  INCOME_SOURCE_NOT_MATCHED: 'Chưa khớp nguồn thu',
  INCOME_SOURCE_CANDIDATES_OMITTED: 'Quá nhiều nguồn thu, vui lòng chọn thủ công',
  INCOME_STREAM_NOT_MATCHED: 'Chưa khớp dòng thu',
  INCOME_STREAM_PARENT_CONFLICT: 'Dòng thu không thuộc nguồn thu đã chọn',
  INCOME_STREAM_CANDIDATES_OMITTED: 'Quá nhiều dòng thu, vui lòng chọn thủ công',
  UNKNOWN_MODEL_TOKEN: 'Mã gợi ý không xác định',
  MODEL_FIELD_INVALID: 'Trường dữ liệu không hợp lệ',
};

const PROMPT_SUGGESTIONS = [
  'Ăn trưa 85k tiền mặt hôm nay',
  'Nhận lương 25 triệu vào MB',
  'Coffee 4.50 USD bằng Wise hôm qua',
] as const;

export interface AiTransactionDraftInputProps {
  readonly accounts: readonly AccountRow[];
  readonly categories: readonly CategoryRow[];
  readonly incomeSources: readonly IncomeSourceWithStreams[];
  readonly onApplyDraft: (draft: ParsedTransactionDraft) => void;
}

export const AiTransactionDraftInput: React.FC<AiTransactionDraftInputProps> = ({
  accounts,
  categories,
  incomeSources,
  onApplyDraft,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedTransactionDraft | null>(null);
  const [parseSource, setParseSource] = useState<'DETERMINISTIC' | 'AI' | null>(null);

  const handleParse = async () => {
    if (!prompt.trim() || isParsing) return;

    setIsParsing(true);
    setErrorMsg(null);
    setDraft(null);
    setParseSource(null);

    try {
      const res = await parseTransactionDraftAction(prompt);
      if (!res.ok) {
        setErrorMsg(res.error.message);
      } else {
        setDraft(res.draft);
        setParseSource(res.parse_source ?? 'AI');
      }
    } catch {
      setErrorMsg('Không thể kết nối đến máy chủ AI. Vui lòng thử lại sau.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleApply = () => {
    if (!draft) return;
    onApplyDraft(draft);
    setDraft(null);
    setParseSource(null);
    setPrompt('');
    setIsOpen(false);
  };

  const handleDismissDraft = () => {
    setDraft(null);
    setParseSource(null);
  };

  // Helper lookups for draft preview
  const matchedAccount = accounts.find((a) => a.id === draft?.account_id);
  const matchedCategory = categories.find((c) => c.id === draft?.category_id);
  const matchedSource = incomeSources.find((s) => s.id === draft?.income_source_id);
  const matchedStream = matchedSource?.streams?.find(
    (st) => st.id === draft?.income_source_stream_id
  );

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus:outline-none"
        >
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span>Nhập nhanh</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            ({isOpen ? 'Ẩn' : 'Hiện'})
          </span>
        </button>
        {isOpen && (
          <span className="text-[10px] text-muted-foreground font-mono">
            {prompt.length}/300
          </span>
        )}
      </div>

      {isOpen && (
        <div className="space-y-2.5 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Xử lý nhanh, dùng AI khi cần
          </p>

          <div className="flex gap-2">
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
              placeholder='Ví dụ: "Ăn trưa 85k tiền mặt hôm nay"'
              disabled={isParsing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleParse();
                }
              }}
              className="text-sm bg-background"
            />
            <Button
              type="button"
              onClick={() => void handleParse()}
              disabled={!prompt.trim() || isParsing}
              size="sm"
              className="shrink-0 font-medium"
            >
              {isParsing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  Đang phân tích...
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  Phân tích
                </>
              )}
            </Button>
          </div>

          {/* Quick suggestions */}
          {!draft && !isParsing && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-muted-foreground">Gợi ý:</span>
              {PROMPT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setPrompt(suggestion)}
                  className="rounded-full bg-background border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="shrink-0 text-destructive/70 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Draft Preview Card */}
          {draft && (
            <div className="rounded-md border bg-background p-3 space-y-2 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      draft.type === 'EXPENSE'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : draft.type === 'INCOME'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {draft.type === 'EXPENSE'
                      ? 'Chi tiêu (-)'
                      : draft.type === 'INCOME'
                      ? 'Thu nhập (+)'
                      : 'Chưa rõ loại'}
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {draft.amount ? formatMoneyWithCode(draft.amount, draft.currency_code || 'VND') : 'Chưa có số tiền'}
                  </span>
                  {parseSource && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {parseSource === 'DETERMINISTIC' ? 'Phân tích nhanh' : 'AI'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleDismissDraft}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Parsed Fields Grid */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <span className="text-muted-foreground">Tài khoản:</span>{' '}
                  <span className={`font-medium ${matchedAccount ? 'text-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
                    {matchedAccount ? matchedAccount.name : 'Chưa nhận diện'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Danh mục:</span>{' '}
                  <span className={`font-medium ${matchedCategory ? 'text-foreground' : 'text-amber-700 dark:text-amber-400'}`}>
                    {matchedCategory ? matchedCategory.name : 'Chưa nhận diện'}
                  </span>
                </div>

                {draft.type === 'INCOME' && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Nguồn thu:</span>{' '}
                      <span className="font-medium text-foreground">
                        {matchedSource ? matchedSource.name : 'Chưa chọn'}
                      </span>
                    </div>
                    {matchedStream && (
                      <div>
                        <span className="text-muted-foreground">Dòng thu:</span>{' '}
                        <span className="font-medium text-foreground">
                          {matchedStream.name}
                        </span>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <span className="text-muted-foreground">Đối tác/Mô tả:</span>{' '}
                  <span className="font-medium text-foreground">
                    {draft.merchant || 'Chưa có'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Ngày:</span>{' '}
                  <span className="font-medium text-foreground">
                    {draft.occurred_on || 'Chưa có'}
                  </span>
                </div>
              </div>

              {/* Warning Badges */}
              {draft.warning_codes.length > 0 && (
                <div className="pt-1.5 border-t">
                  <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <HelpCircle className="h-3 w-3" />
                    <span>Lưu ý từ AI:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {draft.warning_codes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300"
                      >
                        {WARNING_LABELS[code] || code}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Button: Apply to Form (Zero Save Mutation) */}
              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApply}
                  className="w-full sm:w-auto font-semibold gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Áp dụng vào biểu mẫu
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
