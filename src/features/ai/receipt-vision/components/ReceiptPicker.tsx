'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { processReceiptAction } from '../actions';
import type { ReceiptTransactionDraft } from '../types';
import { PHASE_12B_MAX_RECEIPT_FILE_BYTES } from '../constants';

export interface ReceiptPickerProps {
  onApplyDraft: (draft: ReceiptTransactionDraft) => void;
  onCancel: () => void;
}

export function ReceiptPicker({ onApplyDraft, onCancel }: ReceiptPickerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReceiptTransactionDraft | null>(null);
  
  // Track generation to ignore stale results
  const generationRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URL on unmount or replace
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileSelect = (selectedFile: File) => {
    setError(null);
    setDraft(null);
    
    if (selectedFile.size > PHASE_12B_MAX_RECEIPT_FILE_BYTES) {
      setError('Kích thước ảnh vượt quá giới hạn cho phép (4MB).');
      return;
    }

    setFile(selectedFile);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(selectedFile));
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
      
      // If modal was closed or re-analyzed, ignore stale result
      if (currentGeneration !== generationRef.current) return;

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
    // Increment generation to ignore any in-flight results
    generationRef.current++;
    onCancel();
  };

  return (
    <div className="flex flex-col space-y-4 w-full">
      {!file && (
        <div className="flex gap-4 w-full justify-center">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors w-1/2"
          >
            <Camera className="w-8 h-8 text-zinc-400 mb-2" />
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Chụp ảnh</span>
          </button>
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors w-1/2"
          >
            <ImageIcon className="w-8 h-8 text-zinc-400 mb-2" />
            <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">Chọn ảnh</span>
          </button>
        </div>
      )}

      {/* Hidden inputs */}
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

      {file && previewUrl && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 flex justify-center">
            <button 
              type="button"
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 z-10"
              onClick={() => {
                setFile(null);
                setDraft(null);
                setError(null);
              }}
              disabled={isAnalyzing}
            >
              <X className="w-4 h-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={previewUrl} 
              alt="Receipt preview" 
              className="max-h-64 object-contain"
            />
          </div>

          {!draft && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-500 text-center">
                Bằng cách nhấn Phân tích, ảnh này sẽ được gửi tới Google Gemini AI. Dữ liệu không được dùng để huấn luyện mô hình.
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
          )}

          {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {draft && (
            <div className="space-y-4 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 mb-2">
                {draft.can_apply ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                <h4 className="font-medium text-sm">Kết quả phân tích</h4>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Số tiền:</span>
                  <span className="font-medium">{draft.amount} {draft.currency_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Ngày:</span>
                  <span className="font-medium">{draft.occurred_on || 'Không rõ'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Đơn vị:</span>
                  <span className="font-medium truncate max-w-[60%]">{draft.merchant || 'Không rõ'}</span>
                </div>
              </div>

              {draft.warnings.length > 0 && (
                <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded mt-2">
                  <ul className="list-disc pl-4 space-y-1">
                    {draft.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              <p className="text-xs text-zinc-500 text-center italic mt-2">
                Vui lòng kiểm tra lại thông tin trước khi lưu.
              </p>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => onCancel()}
                  className="flex-1 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => onApplyDraft(draft)}
                  disabled={!draft.can_apply}
                  className="flex-1 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
