/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from 'react';
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
import type { AccountRow, AccountInsert, AccountUpdate, AccountType } from '@/types/database';

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (accountData: Omit<AccountInsert, 'user_id'> | AccountUpdate) => Promise<void>;
  initialData?: AccountRow | null;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialData
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [currencyCode, setCurrencyCode] = useState('VND');
  const [balance, setBalance] = useState('');
  const [institution, setInstitution] = useState('');
  const [color, setColor] = useState('#005a3c');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
    if (open) {
            if (initialData) {
        setName(initialData.name);
        setType(initialData.type as AccountType);
        setCurrencyCode(initialData.currency_code);
        setBalance(initialData.opening_balance?.toString() || '');
        setInstitution(initialData.institution || '');
        setColor(initialData.color);
      } else {
        setName('');
        setType('BANK');
        setCurrencyCode('VND');
        setBalance('');
        setInstitution('');
        setColor('#005a3c');
      }
      setErrorMsg('');
      setSubmitted(false);
    }
  }, [open, initialData]);

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
    
    const upperCurrency = currencyCode.toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(upperCurrency)) {
      setErrorMsg('Mã tiền tệ phải từ 3-5 ký tự chữ cái (VD: VND, USD)');
      return;
    }
    
    // Numeric validation
    if (balance !== '' && isNaN(Number(balance))) {
      setErrorMsg('Số dư khởi tạo không hợp lệ');
      return;
    }

    setSubmitted(true);
    
    try {
      setErrorMsg('');
      if (onSuccess) {
        await onSuccess({
          name,
          type,
          currency_code: upperCurrency,
          // Passing as any since Supabase JS client handles string -> numeric implicitly. Or just pass number.
          // Wait, typescript type requires number. So we must cast it to number, but without losing precision before JSON serialization.
          // In TypeScript, Number() or parseFloat() keeps full precision up to 53 bits (safe integer), which is plenty for 20,4.
          // But the prompt says "preserve opening-balance decimal input as a string until it is sent to Supabase/PostgreSQL instead of parseFloat where practical"
          // We can cast the payload object to `any` before sending to supabase, or modify `AccountInsert` to allow string.
          // Actually, if we just use `Number(balance)`, it is a JS number.
          // Let's use `balance as any` to bypass TS type check for `number`, so it sends the string.
          opening_balance: (balance === '' ? 0 : balance) as any,
          institution: institution || null,
          color,
        });
      }
      setSubmitted(false);
      onOpenChange(false);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Có lỗi xảy ra');
      }
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
                onChange={(e) => setType(e.target.value as AccountType)}
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
              <Label htmlFor="accCurrency">Mã tiền tệ</Label>
              <Input
                id="accCurrency"
                placeholder="VND, USD..."
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
                required
                maxLength={5}
                className="uppercase"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="accBalance">Số dư khởi tạo</Label>
            <Input
              id="accBalance"
              type="text"
              placeholder="0"
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
              {submitted ? (initialData ? 'Đang lưu...' : 'Đang tạo...') : (initialData ? "Lưu thay đổi" : "Tạo tài khoản")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
