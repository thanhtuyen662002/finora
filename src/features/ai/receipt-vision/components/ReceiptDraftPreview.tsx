'use client';

/**
 * Finora AI Receipt Vision — Receipt Draft Preview Component
 * Phase 12B — Interactive Draft Preview & Confirmation Foundation
 *
 * Displays extracted transaction draft, derived warnings, and apply gate status.
 * Pure UI component. Unmounted from live transaction forms during Pass 12B.
 */

import React from 'react';
import type { ReceiptTransactionDraft, ReceiptWarningCode } from '../types';

export interface ReceiptDraftPreviewProps {
  readonly draft: ReceiptTransactionDraft;
  readonly categoryName?: string | null;
  readonly onApply?: (draft: ReceiptTransactionDraft) => void;
  readonly onDismiss?: () => void;
  readonly isApplying?: boolean;
}

const WARNING_LABELS: Record<ReceiptWarningCode, { title: string; desc: string; severity: 'warning' | 'info' | 'error' }> = {
  DOCUMENT_UNSUPPORTED: {
    title: 'Tài liệu không phải hóa đơn mua hàng',
    desc: 'Chỉ hỗ trợ tự động điền cho hóa đơn bán lẻ/thanh toán trực tiếp (PURCHASE_RECEIPT).',
    severity: 'error',
  },
  TOTAL_MISSING: {
    title: 'Thiếu tổng tiền',
    desc: 'Không tìm thấy số tiền thanh toán cuối cùng trên ảnh.',
    severity: 'error',
  },
  TOTAL_AMBIGUOUS: {
    title: 'Số tiền không rõ ràng',
    desc: 'Có nhiều số tiền khác nhau hoặc không xác định được tổng thanh toán chính xác.',
    severity: 'error',
  },
  CURRENCY_MISSING: {
    title: 'Thiếu đơn vị tiền tệ',
    desc: 'Không tìm thấy ký hiệu hoặc mã tiền tệ trên hóa đơn.',
    severity: 'error',
  },
  CURRENCY_AMBIGUOUS: {
    title: 'Đơn vị tiền tệ không thống nhất',
    desc: 'Hóa đơn chứa nhiều loại tiền tệ mâu thuẫn.',
    severity: 'error',
  },
  CURRENCY_UNSUPPORTED: {
    title: 'Tiền tệ không được hỗ trợ',
    desc: 'Hệ thống chỉ hỗ trợ VND, USD, EUR, JPY, CNY, KRW.',
    severity: 'error',
  },
  DATE_MISSING: {
    title: 'Thiếu ngày giao dịch',
    desc: 'Không tìm thấy ngày tháng trên hóa đơn.',
    severity: 'error',
  },
  DATE_AMBIGUOUS: {
    title: 'Ngày giao dịch không rõ ràng',
    desc: 'Có nhiều mốc thời gian mâu thuẫn trên hóa đơn.',
    severity: 'error',
  },
  DATE_INVALID: {
    title: 'Ngày giao dịch không hợp lệ',
    desc: 'Ngày trên hóa đơn không tồn tại trên lịch.',
    severity: 'error',
  },
  MERCHANT_MISSING: {
    title: 'Chưa nhận diện tên đơn vị bán',
    desc: 'Không xác định được tên cửa hàng hoặc người nhận.',
    severity: 'info',
  },
  CATEGORY_UNRESOLVED: {
    title: 'Chưa phân loại danh mục',
    desc: 'AI không tìm thấy danh mục phù hợp trong danh sách của bạn.',
    severity: 'info',
  },
  CATEGORY_STALE: {
    title: 'Danh mục đã thay đổi',
    desc: 'Danh mục được đề xuất không còn tồn tại hoặc đã bị lưu trữ.',
    severity: 'warning',
  },
  ACCOUNT_REQUIRED: {
    title: 'Cần chọn tài khoản thanh toán',
    desc: 'Receipt Vision không tự động chọn tài khoản để đảm bảo an toàn.',
    severity: 'info',
  },
  IMAGE_QUALITY_LOW: {
    title: 'Chất lượng ảnh mờ/kém',
    desc: 'Ảnh có thể bị mờ hoặc thiếu sáng, vui lòng kiểm tra lại thông tin.',
    severity: 'warning',
  },
};

export function ReceiptDraftPreview({
  draft,
  categoryName,
  onApply,
  onDismiss,
  isApplying = false,
}: ReceiptDraftPreviewProps) {
  const isPurchase = draft.document_kind === 'PURCHASE_RECEIPT';

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Bản nháp giao dịch từ hóa đơn
          </h3>
          <p className="text-xs text-muted-foreground">
            Trích xuất tự động qua AI. Xem lại và xác nhận trước khi lưu.
          </p>
        </div>
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isPurchase
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}
        >
          {draft.document_kind}
        </span>
      </div>

      {/* Primary Extracted Fields Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg bg-muted/40 p-2.5">
          <span className="text-xs text-muted-foreground block">Số tiền</span>
          <span className="font-semibold text-foreground">
            {draft.amount ? `${draft.amount} ${draft.currency_code ?? ''}` : '—'}
          </span>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <span className="text-xs text-muted-foreground block">Ngày giao dịch</span>
          <span className="font-medium text-foreground">
            {draft.occurred_on ?? '—'}
          </span>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <span className="text-xs text-muted-foreground block">Đơn vị bán</span>
          <span className="font-medium text-foreground truncate block">
            {draft.merchant ?? '—'}
          </span>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <span className="text-xs text-muted-foreground block">Danh mục đề xuất</span>
          <span className="font-medium text-foreground truncate block">
            {categoryName || (draft.category_id ? 'Đã chọn' : 'Chưa xác định')}
          </span>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <span className="text-xs text-muted-foreground block">Tài khoản</span>
          <span className="text-muted-foreground italic">Người dùng tự chọn</span>
        </div>

        <div className="rounded-lg bg-muted/40 p-2.5">
          <span className="text-xs text-muted-foreground block">Ghi chú tóm tắt</span>
          <span className="font-medium text-foreground truncate block">
            {draft.note ?? '—'}
          </span>
        </div>
      </div>

      {/* Warnings & Diagnostics */}
      {draft.warnings.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            Thông tin kiểm tra ({draft.warnings.length})
          </span>
          <div className="space-y-1.5">
            {draft.warnings.map((code) => {
              const meta = WARNING_LABELS[code] || {
                title: code,
                desc: 'Cảnh báo hệ thống',
                severity: 'info',
              };

              const badgeColor =
                meta.severity === 'error'
                  ? 'border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-400'
                  : meta.severity === 'warning'
                  ? 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400'
                  : 'border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-400';

              return (
                <div
                  key={code}
                  className={`rounded-lg border px-3 py-2 text-xs ${badgeColor} flex items-start justify-between gap-2`}
                >
                  <div>
                    <span className="font-medium block">{meta.title}</span>
                    <span className="opacity-80 block text-[11px] mt-0.5">{meta.desc}</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-60 uppercase">{code}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <div className="text-xs">
          {draft.can_apply ? (
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              ✓ Đủ điều kiện điền vào biểu mẫu
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400 font-medium">
              ✕ Thiếu thông tin bắt buộc (số tiền, ngày, loại hóa đơn)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-foreground hover:bg-muted font-medium transition-colors"
            >
              Hủy
            </button>
          )}

          {onApply && (
            <button
              type="button"
              disabled={!draft.can_apply || isApplying}
              onClick={() => onApply(draft)}
              className="px-4 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity shadow-sm"
            >
              {isApplying ? 'Đang điền...' : 'Điền vào biểu mẫu'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
