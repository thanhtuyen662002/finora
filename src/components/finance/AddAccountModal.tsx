"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PlusCircle, Check } from 'lucide-react';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (accountData: Omit<import('@/types/database').AccountInsert, 'user_id'> | import('@/types/database').AccountUpdate) => Promise<void>;
  initialData?: any;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialData
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || 'BANK');
  const [currencyCode, setCurrencyCode] = useState(initialData?.currency_code || 'VND');
  const [balance, setBalance] = useState(initialData?.opening_balance?.toString() || '');
  const [institution, setInstitution] = useState(initialData?.institution || '');
  const [color, setColor] = useState(initialData?.color || '#005a3c');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const colors = [
    '#005a3c', // Green
    '#002f6c', // MB Blue
    '#16a34a', // Emerald
    '#a50064', // MoMo Pink
    '#003087', // PayPal Blue
    '#37517e', // Wise Navy
    '#dc2626', // Red
    '#7c3aed', // Purple
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    setSubmitted(true);
    
    try {
      setErrorMsg('');
      if (onSuccess) {
        await onSuccess({
          name,
          type,
          currency_code: currencyCode,
          opening_balance: parseFloat(balance) || 0,
          institution: institution || null,
          color,
        });
      }
      setSubmitted(false);
      onOpenChange(false);
      if (!initialData) {
        setName('');
        setBalance('');
        setInstitution('');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra');
      setSubmitted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <span>{initialData ? "Sửa tài khoản" : "Thêm tài khoản / ví"}</span>
          </DialogTitle>
          <DialogDescription>
            {initialData ? "Chỉnh sửa thông tin tài khoản." : "Tạo tài khoản ngân hàng, ví điện tử hoặc quỹ tiền mặt để quản lý."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMsg && <div className="text-sm font-medium text-destructive">{errorMsg}</div>}
          <div className="space-y-1.5">
            <Label htmlFor="accName">Tên tài khoản</Label>
            <Input
              id="accName"
              placeholder="Ví dụ: Vietcombank Lương, MoMo, PayPal..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="accType">Loại tài khoản</Label>
              <Select
                id="accType"
                value={type}
                onChange={(e) => setType(e.target.value)}
                options={[
                  { value: 'BANK', label: 'Ngân hàng' },
                  { value: 'CASH', label: 'Tiền mặt' },
                  { value: 'EWALLET', label: 'Ví điện tử' },
                  { value: 'SAVINGS', label: 'Sổ tiết kiệm' },
                  { value: 'CREDIT_CARD', label: 'Thẻ tín dụng' },
                  { value: 'INVESTMENT', label: 'Đầu tư' },
                  { value: 'OTHER', label: 'Khác' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accCurrency">Tiền tệ chính</Label>
              <Select
                id="accCurrency"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                options={[
                  { value: 'VND', label: 'VND (₫)' },
                  { value: 'USD', label: 'USD ($)' },
                  { value: 'EUR', label: 'EUR (€)' },
                  { value: 'JPY', label: 'JPY (¥)' },
                  { value: 'CNY', label: 'CNY (¥)' },
                  { value: 'KRW', label: 'KRW (₩)' },
                ]}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accBalance">Số dư ban đầu</Label>
            <Input
              id="accBalance"
              type="number"
              step="any"
              placeholder={currencyCode === 'VND' ? '10000000' : '500.00'}
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="institution">Tổ chức tài chính (tùy chọn)</Label>
            <Input
              id="institution"
              placeholder="Ví dụ: Vietcombank, Techcombank, PayPal..."
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Màu sắc nhận diện</Label>
            <div className="flex gap-2 pt-1">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-7 w-7 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: c }}
                >
                  {color === c && <Check className="h-4 w-4 text-white" />}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={submitted || !name}>
              {submitted ? 'Đang tạo...' : initialData ? "Lưu thay đổi" : "Tạo tài khoản"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
