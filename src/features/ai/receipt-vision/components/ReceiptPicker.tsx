'use client';

/**
 * Finora AI Receipt Vision — Receipt Picker & Local Preview UI Foundation
 * Phase 12B — Client Preview Component
 *
 * Unmounted from live user transactions during Pass 12B-1.
 * Strict local object URL lifecycle and Vietnamese privacy disclosure.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, AlertCircle, X, Loader2, Sparkles } from 'lucide-react';
import { PHASE_12B_MAX_RECEIPT_FILE_BYTES } from '../constants';

export interface ReceiptPickerProps {
  readonly onAnalyze?: (file: File) => Promise<void>;
  readonly isAnalyzing?: boolean;
  readonly externalError?: string | null;
  readonly onDismiss?: () => void;
}

export function ReceiptPicker({
  onAnalyze,
  isAnalyzing = false,
  externalError,
  onDismiss,
}: ReceiptPickerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Keep ref in sync for unmount cleanup
  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  // Clean up object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const clearSelection = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalError(null);
    const files = e.target.files;
    if (!files || files.length === 0) {
      clearSelection();
      return;
    }

    const file = files[0];

    // Client-side UX preflight checks
    if (file.size > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
      setLocalError('Kích thước ảnh vượt quá giới hạn 4MB. Vui lòng chọn ảnh nhỏ hơn.');
      clearSelection();
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (file.type && !allowedTypes.includes(file.type.toLowerCase())) {
      setLocalError('Chỉ hỗ trợ định dạng ảnh JPEG, PNG hoặc WebP.');
      clearSelection();
      return;
    }

    // Revoke previous URL if any
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    const newUrl = URL.createObjectURL(file);
    previewUrlRef.current = newUrl;
    setSelectedFile(file);
    setPreviewUrl(newUrl);
  }, [clearSelection]);

  const handleClear = useCallback(() => {
    clearSelection();
    setLocalError(null);
  }, [clearSelection]);

  const handleAnalyzeClick = useCallback(async () => {
    if (!selectedFile || isAnalyzing || !onAnalyze) return;
    setLocalError(null);
    try {
      await onAnalyze(selectedFile);
    } catch {
      setLocalError('Không thể gửi yêu cầu phân tích hóa đơn. Vui lòng thử lại.');
    }
  }, [selectedFile, isAnalyzing, onAnalyze]);

  const displayedError = localError || externalError;

  return (
    <div id="receipt-picker-container" className="w-full space-y-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground text-sm">Quét hóa đơn thông minh</h3>
        </div>
        {onDismiss && (
          <button
            id="receipt-picker-dismiss-btn"
            type="button"
            onClick={onDismiss}
            disabled={isAnalyzing}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        id="receipt-file-input"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={isAnalyzing}
        className="hidden"
      />

      {/* Drop/Select Zone or Preview */}
      {!previewUrl ? (
        <div
          id="receipt-dropzone"
          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 px-4 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
        >
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <p className="font-medium text-foreground text-sm">Bấm để tải ảnh hóa đơn</p>
          <p className="text-muted-foreground text-xs">Hỗ trợ JPEG, PNG, WebP (tối đa 4MB)</p>
        </div>
      ) : (
        <div id="receipt-preview-zone" className="relative overflow-hidden rounded-lg border border-border bg-muted/20">
          <div className="relative flex max-h-64 items-center justify-center p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Xem trước hóa đơn"
              className="max-h-60 rounded object-contain"
            />
          </div>
          <div className="flex items-center justify-between border-t border-border bg-card/90 px-3 py-2 text-xs">
            <div className="flex items-center gap-1.5 truncate text-muted-foreground">
              <ImageIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{selectedFile?.name}</span>
            </div>
            {!isAnalyzing && (
              <button
                id="receipt-clear-btn"
                type="button"
                onClick={handleClear}
                className="text-destructive hover:underline font-medium ml-2 shrink-0"
              >
                Chọn ảnh khác
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error display */}
      {displayedError && (
        <div id="receipt-error-banner" className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{displayedError}</span>
        </div>
      )}

      {/* Privacy disclosure */}
      <div id="receipt-privacy-disclosure" className="rounded-lg bg-muted/40 p-3 text-muted-foreground text-xs leading-relaxed">
        <p>
          Finora không lưu ảnh hóa đơn. Khi bạn bấm &ldquo;Phân tích hóa đơn&rdquo;, ảnh sẽ được gửi tới nhà cung cấp AI đã cấu hình để phân tích.
        </p>
        <p className="mt-1 font-medium text-foreground/80">
          Vui lòng kiểm tra lại thông tin trước khi lưu.
        </p>
      </div>

      {/* Action button */}
      {previewUrl && (
        <button
          id="receipt-analyze-btn"
          type="button"
          onClick={handleAnalyzeClick}
          disabled={isAnalyzing || !selectedFile}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 px-4 font-medium text-primary-foreground text-sm shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Đang phân tích hóa đơn...</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              <span>Phân tích hóa đơn</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}
