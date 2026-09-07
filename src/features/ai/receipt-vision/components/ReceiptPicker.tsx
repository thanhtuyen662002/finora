'use client';

import { useState, useRef, useEffect, type DragEvent } from 'react';
import { Camera, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { processReceiptAction } from '../actions';
import type { ReceiptTransactionDraft, ReceiptWarningCode } from '../types';
import { PHASE_12B_MAX_RECEIPT_FILE_BYTES } from '../constants';

export interface ReceiptPickerProps {
  onApplyDraft: (draft: ReceiptTransactionDraft) => void;
  onCancel: () => void;
}

const WARNING_LABELS: Record<ReceiptWarningCode, string> = {
  DOCUMENT_UNSUPPORTED: 'Loại tài liệu không hỗ trợ (không phải hóa đơn mua hàng)',
  IMAGE_QUALITY_LOW: 'Chất lượng ảnh thấp',
  TOTAL_MISSING: 'Không tìm thấy tổng tiền',
  TOTAL_AMBIGUOUS: 'Tổng tiền không rõ ràng',
  CURRENCY_MISSING: 'Không tìm thấy đơn vị tiền tệ',
  CURRENCY_AMBIGUOUS: 'Đơn vị tiền tệ không rõ ràng',
  CURRENCY_UNSUPPORTED: 'Đơn vị tiền tệ không được hỗ trợ',
  DATE_MISSING: 'Không tìm thấy ngày giao dịch',
  DATE_AMBIGUOUS: 'Ngày giao dịch không rõ ràng',
  DATE_INVALID: 'Ngày giao dịch không hợp lệ',
  MERCHANT_MISSING: 'Không tìm thấy tên đơn vị bán',
  CATEGORY_UNRESOLVED: 'Chưa xác định danh mục phù hợp',
  CATEGORY_STALE: 'Danh mục đã thay đổi hoặc không khả dụng',
  ACCOUNT_REQUIRED: 'Cần chọn tài khoản thanh toán',
};

export function ReceiptPicker({ onApplyDraft, onCancel }: ReceiptPickerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReceiptTransactionDraft | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const generationRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL on unmount and invalidate in-flight requests
  useEffect(() => {
    const genRef = generationRef;
    return () => {
      genRef.current += 1;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const clearSelection = () => {
    generationRef.current++;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setFile(null);
    setDraft(null);
    setError(null);
  };

  const handleFileSelect = (selectedFile: File) => {
    generationRef.current++;
    setError(null);
    setDraft(null);

    if (selectedFile.size > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
      setError('Kích thước ảnh vượt quá giới hạn cho phép (4MB).');
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleAnalyze = async () => {
    if (!file || isAnalyzing) return;

    setIsAnalyzing(true);
    setError(null);
    setDraft(null);

    const currentGeneration = ++generationRef.current;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await processReceiptAction(formData);

      if (currentGeneration !== generationRef.current) return;

      // Revoke Object URL immediately on scan completion to prevent memory leaks
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      if (result.ok && result.draft) {
        setDraft(result.draft);
      } else {
        setError(result.error || 'Có lỗi xảy ra khi phân tích hóa đơn.');
      }
    } catch {
      if (currentGeneration === generationRef.current) {
        setError('Có lỗi hệ thống xảy ra, vui lòng thử lại sau.');
      }
    } finally {
      if (currentGeneration === generationRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  const handleCancel = () => {
    generationRef.current++;
    clearSelection();
    onCancel();
  };

  return (
    <div className="flex flex-col space-y-4 w-full">
      {!file && !draft && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors ${
            isDragging
              ? 'border-zinc-500 bg-zinc-100 dark:bg-zinc-800'
              : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900'
          }`}
        >
          <div className="flex gap-4 w-full justify-center mb-3">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-1/2"
            >
              <Camera className="w-6 h-6 text-zinc-500 mb-1" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Chụp ảnh</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center p-4 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-1/2"
            >
              <ImageIcon className="w-6 h-6 text-zinc-500 mb-1" />
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Chọn ảnh</span>
            </button>
          </div>
          <p className="text-xs text-zinc-400">hoặc kéo và thả tệp ảnh hóa đơn vào đây</p>
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={cameraInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
          }
          e.target.value = '';
        }}
      />

      {file && previewUrl && !draft && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex justify-center">
            <button
              type="button"
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 z-10"
              onClick={clearSelection}
              disabled={isAnalyzing}
            >
              <X className="w-4 h-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt="Receipt preview" className="max-h-64 object-contain" />
          </div>

          <div className="space-y-3">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
              Finora không lưu ảnh hóa đơn. Khi bạn bấm ‘Phân tích hóa đơn’, ảnh sẽ được gửi tới nhà cung cấp AI đã cấu hình để phân tích.
            </p>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="w-full flex justify-center items-center gap-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang phân tích...
                </>
              ) : (
                'Phân tích hóa đơn'
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div
          className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm leading-relaxed text-red-900 dark:border-red-800/80 dark:bg-red-950/60 dark:text-red-100"
          role="alert"
        >
          <span className="mt-0.5 shrink-0 rounded-full bg-red-200 p-0.5 text-red-800 dark:bg-red-900/80 dark:text-red-100">
            <AlertCircle className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="min-w-0 break-words">{error}</p>
        </div>
      )}

      {draft && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {draft.can_apply ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-500" />
              )}
              <h4 className="font-medium text-sm">Kết quả phân tích</h4>
            </div>
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 underline"
            >
              Chọn ảnh khác
            </button>
          </div>

          <div className="space-y-2 text-sm">
            {draft.amount && (
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">Số tiền:</span>
                <span className="font-medium">
                  {draft.amount} {draft.currency_code ?? ''}
                </span>
              </div>
            )}
            {draft.occurred_on && (
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">Ngày:</span>
                <span className="font-medium">{draft.occurred_on}</span>
              </div>
            )}
            {draft.merchant && (
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">Đơn vị bán:</span>
                <span className="font-medium truncate max-w-[60%]">{draft.merchant}</span>
              </div>
            )}
            {draft.note && (
              <div className="flex justify-between">
                <span className="text-zinc-600 dark:text-zinc-300">Ghi chú:</span>
                <span className="font-medium truncate max-w-[60%]">{draft.note}</span>
              </div>
            )}
          </div>

          {draft.warnings.length > 0 && (
            <section
              className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-700/80 dark:bg-amber-950/50 dark:text-amber-50"
              role="alert"
              aria-label="Cảnh báo từ kết quả phân tích hóa đơn"
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 rounded-full bg-amber-200 p-1 text-amber-800 dark:bg-amber-900/80 dark:text-amber-100">
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <h5 className="text-sm font-semibold leading-tight">Cần kiểm tra trước khi áp dụng</h5>
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/80 dark:text-amber-100">
                      {draft.warnings.length} cảnh báo
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1.5">
                {draft.warnings.map((warningCode) => (
                  <li
                    key={warningCode}
                    className="flex items-start gap-2 rounded-lg border border-amber-200 bg-white/75 px-2.5 py-2 text-xs font-medium leading-relaxed text-amber-950 dark:border-amber-800/70 dark:bg-black/20 dark:text-amber-50"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-700 dark:bg-amber-300" aria-hidden="true" />
                    <span className="min-w-0 break-words">{WARNING_LABELS[warningCode] || warningCode}</span>
                  </li>
                ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          <p className="mt-2 text-center text-xs italic text-zinc-600 dark:text-zinc-300">
            Vui lòng kiểm tra lại thông tin trước khi lưu.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => onApplyDraft(draft)}
              disabled={!draft.can_apply}
              className="flex-1 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Áp dụng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
