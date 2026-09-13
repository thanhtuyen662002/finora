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
import { MoneyInput } from './MoneyInput';
import type { AccountRow, AccountInsert, AccountUpdate, AccountType } from '@/types/database';
import { getDebts } from '@/features/debts';
import type { Debt } from '@/features/debts/types';

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
  initialData,
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('BANK');
  const [currencyCode, setCurrencyCode] = useState('VND');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [linkedDebtId, setLinkedDebtId] = useState('');
  const [debts, setDebts] = useState<Debt[]>([]);
  const [institution, setInstitution] = useState('');
  const [color, setColor] = useState('#005a3c');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setName(initialData.name);
      setType(initialData.type as AccountType);
      setCurrencyCode(initialData.currency_code);
      setBalance(initialData.opening_balance?.toString() || '');
      setCreditLimit(initialData.credit_limit?.toString() || '');
      setLinkedDebtId(initialData.linked_debt_id || '');
      setInstitution(initialData.institution || '');
      setColor(initialData.color);
    } else {
      setName('');
      setType('BANK');
      setCurrencyCode('VND');
      setBalance('');
      setCreditLimit('');
      setLinkedDebtId('');
      setInstitution('');
      setColor('#005a3c');
    }

    setErrorMsg('');
    setSubmitted(false);
    void getDebts().then(setDebts).catch(() => setDebts([]));
  }, [open, initialData]);

  const colors = [
    '#005a3c',
    '#002f6c',
    '#16a34a',
    '#a50064',
    '#003087',
    '#37517e',
    '#dc2626',
    '#7c3aed',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const upperCurrency = currencyCode.trim().toUpperCase();
    if (!/^[A-Z]{3,5}$/.test(upperCurrency)) {
      setErrorMsg('Mã tiền tệ phải từ 3-5 ký tự chữ cái (VD: VND, USD)');
      return;
    }

    const normalizedBalance = balance.trim() === '' ? '0' : balance.trim();
    if (!/^-?\d+(?:\.\d{1,4})?$/.test(normalizedBalance)) {
      setErrorMsg('Số dư khởi tạo phải là số hợp lệ và tối đa 4 chữ số thập phân');
      return;
    }

    const normalizedCreditLimit = creditLimit.trim();
    if (linkedDebtId && (!normalizedCreditLimit || !/^\d+(?:\.\d{1,4})?$/.test(normalizedCreditLimit))) {
      setErrorMsg('Tài khoản liên kết khoản nợ phải có hạn mức tín dụng hợp lệ.');
      return;
    }
    if (linkedDebtId && balance.trim() && balance.trim() !== '0') {
      setErrorMsg('Tài khoản tín dụng nên có số dư khởi tạo bằng 0; dư nợ được theo dõi ở mục Khoản nợ.');
      return;
    }

    setSubmitted(true);
    setErrorMsg('');

    try {
      if (onSuccess) {
        await onSuccess({
          name: name.trim(),
          type,
          currency_code: upperCurrency,
          opening_balance: normalizedBalance,
          credit_limit: normalizedCreditLimit || null,
          linked_debt_id: linkedDebtId || null,
          institution: institution.trim() || null,
          color,
        });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra');
    } finally {
      setSubmitted(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <span>{initialData ? 'Sửa tài khoản' : 'Thêm tài khoản / ví'}</span>
          </DialogTitle>
          <DialogDescription>
            {initialData ? 'Chỉnh sửa thông tin tài khoản.' : 'Tạo tài khoản ngân hàng, ví điện tử hoặc quỹ tiền mặt để quản lý.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMsg && (
            <div className="finora-notice-error rounded-lg border px-3 py-2 text-sm font-medium" role="alert">
              {errorMsg}
            </div>
          )}
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
          {(type === 'CREDIT_CARD' || type === 'EWALLET' || Boolean(linkedDebtId)) && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Hạn mức & liên kết khoản nợ</p>
                <p className="text-xs text-muted-foreground">Mỗi chi tiêu mới bằng tài khoản này sẽ tự cộng vào dư nợ liên kết.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="creditLimit">Hạn mức tín dụng ({currencyCode || 'VND'})</Label>
                <MoneyInput
                  id="creditLimit"
                  currencyCode={currencyCode || 'VND'}
                  placeholder="Ví dụ: 15.000.000"
                  value={creditLimit}
                  onChange={(val) => setCreditLimit(val)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkedDebt">Khoản nợ liên kết</Label>
                <Select
                  id="linkedDebt"
                  value={linkedDebtId}
                  onChange={(e) => setLinkedDebtId(e.target.value)}
                  options={[
                    { value: '', label: '-- Chưa liên kết --' },
                    ...debts
                      .filter((debt) => debt.currency_code === currencyCode.toUpperCase() && !debt.is_archived)
                      .map((debt) => ({ value: debt.id, label: `${debt.name} (${debt.outstanding_amount} ${debt.currency_code})` })),
                  ]}
                />
                {debts.length === 0 && <p className="text-xs text-muted-foreground">Hãy tạo khoản nợ trước tại mục Khoản nợ.</p>}
              </div>
            </div>
          )}
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
            <Label htmlFor="accBalance">Số dư khởi tạo ({currencyCode || 'VND'})</Label>
            <MoneyInput
              id="accBalance"
              currencyCode={currencyCode || 'VND'}
              placeholder="0"
              value={balance}
              onChange={(val) => setBalance(val)}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={submitted || !name.trim()}>
              {submitted ? (initialData ? 'Đang lưu...' : 'Đang tạo...') : (initialData ? 'Lưu thay đổi' : 'Tạo tài khoản')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

