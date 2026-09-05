'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Image as ImageIcon, Loader2, AlertCircle, X, Check, ArrowRight } from 'lucide-react';
import { analyzeReceiptAction } from '../actions';
import type { ReceiptTransactionDraft, ReceiptWarningCode } from '../types';
import { formatMoneyWithCode } from '@/lib/money';

export const RECEIPT_WARNING_LABELS: Record<ReceiptWarningCode, string> = {
  DOCUMENT_UNSUPPORTED: 'Không phải hóa đơn mua hàng hợp lệ',
  TOTAL_MISSING: 'Không tìm thấy tổng tiền',
  TOTAL_AMBIGUOUS: 'Tổng tiền không rõ ràng',
  CURRENCY_MISSING: 'Chưa rõ loại tiền tệ',
  CURRENCY_AMBIGUOUS: 'Tiền tệ không rõ ràng',
  CURRENCY_UNSUPPORTED: 'Loại tiền tệ không được hỗ trợ',
  DATE_MISSING: 'Không tìm thấy ngày giao dịch',
  DATE_AMBIGUOUS: 'Ngày giao dịch không rõ ràng',
  DATE_INVALID: 'Ngày giao dịch không hợp lệ',
  MERCHANT_MISSING: 'Không tìm thấy tên cửa hàng',
  CATEGORY_UNRESOLVED: 'Không khớp với danh mục nào',
  CATEGORY_STALE: 'Danh mục không còn hợp lệ',
  ACCOUNT_REQUIRED: 'Cần chọn tài khoản thanh toán',
  IMAGE_QUALITY_LOW: 'Ảnh mờ hoặc không rõ nét',
};

export interface ReceiptPickerProps {
  readonly onApplyDraft: (draft: ReceiptTransactionDraft) => void;
}

export const ReceiptPicker: React.FC<ReceiptPickerProps> = ({ onApplyDraft }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReceiptTransactionDraft | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4194304) {
      setErrorMsg('Kích thước tệp quá lớn (tối đa 4MB).');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMsg(null);
    setDraft(null);
    setIsAnalyzing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await analyzeReceiptAction(formData);
      if (!res.ok) {
        setErrorMsg(res.error || 'Có lỗi xảy ra khi phân tích hóa đơn.');
      } else if (res.data) {
        setDraft(res.data);
      }
    } catch (error) {
      setErrorMsg('Không thể kết nối máy chủ phân tích hóa đơn.');
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleApply = () => {
    if (!draft) return;
    onApplyDraft(draft);
    handleDismiss();
  };

  const handleDismiss = () => {
    setDraft(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setIsOpen(false);
    setErrorMsg(null);
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2.5 mb-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline focus:outline-none"
        >
          <Camera className="h-4 w-4 text-primary" />
          <span>Quét hóa đơn</span>
          <span className="text-[10px] text-muted-foreground font-normal">
            ({isOpen ? 'Ẩn' : 'Hiện'})
          </span>
        </button>
      </div>

      {isOpen && (
        <div className="space-y-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            Sử dụng AI để phân tích hóa đơn mua hàng. Ảnh chỉ được xử lý một lần, không lưu trữ (Zero Retention). Dữ liệu tài chính không bị thay đổi cho đến khi bạn xác nhận &quot;Lưu giao dịch&quot;.
          </p>

          {!previewUrl && !isAnalyzing && !draft && (
            <div className="flex gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full font-medium"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                Chọn ảnh hóa đơn (Max 4MB)
              </Button>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex items-center justify-center p-6 border rounded-md bg-background">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <span className="text-sm font-medium">Đang phân tích hóa đơn...</span>
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
              <button
                type="button"
                onClick={() => {
                   setErrorMsg(null);
                   if (previewUrl) {
                     URL.revokeObjectURL(previewUrl);
                     setPreviewUrl(null);
                   }
                }}
                className="shrink-0 text-destructive/70 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {draft && previewUrl && (
            <div className="rounded-md border bg-background p-3 space-y-3 shadow-xs">
              <div className="flex items-center justify-between border-b pb-2">
                 <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 px-2 py-0.5 text-[11px] font-semibold">
                    Hóa đơn mua hàng
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {draft.amount ? formatMoneyWithCode(draft.amount, draft.currency_code || 'VND') : 'Chưa rõ số tiền'}
                  </span>
                 </div>
                 <button
                  type="button"
                  onClick={handleDismiss}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Tên cửa hàng:</span>
                  <span className="font-medium text-foreground">{draft.merchant || 'Chưa nhận diện'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Ngày:</span>
                  <span className="font-medium text-foreground">{draft.occurred_on || 'Chưa nhận diện'}</span>
                </div>
              </div>

              {draft.warnings.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>Cảnh báo từ AI:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {draft.warnings.map((code) => (
                       <span
                         key={code}
                         className="inline-flex items-center rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 text-[10px] text-amber-800 dark:text-amber-300"
                       >
                         {RECEIPT_WARNING_LABELS[code] || code}
                       </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t">
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
