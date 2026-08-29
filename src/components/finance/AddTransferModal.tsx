import React, { useState, useEffect, useMemo } from 'react';
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
import { ArrowRightLeft, AlertCircle, CheckCircle2, RotateCcw, Ban } from 'lucide-react';
import { MoneyInput } from './MoneyInput';
import { AccountRow } from '@/types/database';
import {
  createTransfer,
  updateTransfer,
  voidTransfer,
  restoreTransfer,
  ExtendedTransfer,
} from '@/features/transfers';
import { getAccounts } from '@/features/accounts/accounts';
import { isPositiveExactDecimal, toExactDecimal } from '@/lib/money';

interface AddTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void | Promise<void>;
  initialData?: ExtendedTransfer | null;
  accounts?: AccountRow[];
  preselectedFromAccountId?: string;
}

export const AddTransferModal: React.FC<AddTransferModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  initialData,
  accounts: propAccounts = [],
  preselectedFromAccountId,
}) => {
  const [internalAccounts, setInternalAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    if (open && !propAccounts.length) {
      getAccounts()
        .then((accs) => {
          if (active) setInternalAccounts(accs);
        })
        .catch((error: unknown) => {
          console.error(error);
        });
    }
    return () => {
      active = false;
    };
  }, [open, propAccounts.length]);

  const accounts = propAccounts.length > 0 ? propAccounts : internalAccounts;

  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [occurredOn, setOccurredOn] = useState(() => new Date().toISOString().substring(0, 10));

  // Determine available from-accounts
  const availableFromAccounts = useMemo(() => {
    if (initialData) {
      // In edit mode: allow active accounts PLUS the historical from_account if archived
      return accounts.filter((a) => !a.is_archived || a.id === initialData.from_account_id);
    }
    return accounts.filter((a) => !a.is_archived);
  }, [accounts, initialData]);

  // Selected source account object
  const selectedFromAccount = useMemo(() => {
    return accounts.find((a) => a.id === fromAccountId);
  }, [accounts, fromAccountId]);

  // Determine available to-accounts (same currency, distinct from fromAccount)
  const availableToAccounts = useMemo(() => {
    if (!selectedFromAccount) return [];
    const sourceCurrency = selectedFromAccount.currency_code;

    if (initialData) {
      // In edit mode: allow active same-currency accounts (except source) PLUS historical to_account if archived
      return accounts.filter(
        (a) =>
          a.id !== fromAccountId &&
          a.currency_code === sourceCurrency &&
          (!a.is_archived || a.id === initialData.to_account_id)
      );
    }

    return accounts.filter(
      (a) => !a.is_archived && a.id !== fromAccountId && a.currency_code === sourceCurrency
    );
  }, [accounts, fromAccountId, selectedFromAccount, initialData]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!open) return;

    setSubmitted(false);
    setErrorMsg('');

    if (initialData) {
      setFromAccountId(initialData.from_account_id);
      setToAccountId(initialData.to_account_id);
      setAmount(initialData.amount);
      setNote(initialData.note || '');
      setOccurredOn(initialData.occurred_on || new Date().toISOString().substring(0, 10));
    } else {
      const activeAccounts = accounts.filter((a) => !a.is_archived);
      let initialFrom = preselectedFromAccountId && activeAccounts.some((a) => a.id === preselectedFromAccountId)
        ? preselectedFromAccountId
        : '';

      if (!initialFrom && activeAccounts.length > 0) {
        // Prefer an account that has at least one other same-currency account
        const accWithPair = activeAccounts.find((a) =>
          activeAccounts.some((other) => other.id !== a.id && other.currency_code === a.currency_code)
        );
        initialFrom = accWithPair ? accWithPair.id : activeAccounts[0].id;
      }

      setFromAccountId(initialFrom);

      // Find compatible destination account
      if (initialFrom) {
        const fromAcc = accounts.find((a) => a.id === initialFrom);
        if (fromAcc) {
          const compatibleTo = activeAccounts.find(
            (a) => a.id !== initialFrom && a.currency_code === fromAcc.currency_code
          );
          setToAccountId(compatibleTo ? compatibleTo.id : '');
        } else {
          setToAccountId('');
        }
      } else {
        setToAccountId('');
      }

      setAmount('');
      setNote('');
      setOccurredOn(new Date().toISOString().substring(0, 10));
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, initialData, accounts, preselectedFromAccountId]);

  // Handle change in from-account
  const handleFromAccountChange = (newFromId: string) => {
    setFromAccountId(newFromId);
    const newFromAcc = accounts.find((a) => a.id === newFromId);
    if (!newFromAcc) {
      setToAccountId('');
      return;
    }

    // Check if current toAccountId is still compatible
    const isToStillValid = availableToAccounts.some(
      (a) => a.id === toAccountId && a.id !== newFromId && a.currency_code === newFromAcc.currency_code
    );

    if (!isToStillValid) {
      const firstValidTo = accounts.find(
        (a) =>
          (!a.is_archived || (initialData && a.id === initialData.to_account_id)) &&
          a.id !== newFromId &&
          a.currency_code === newFromAcc.currency_code
      );
      setToAccountId(firstValidTo ? firstValidTo.id : '');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!fromAccountId) {
      setErrorMsg('Vui lòng chọn tài khoản chuyển (nguồn)');
      return;
    }

    if (!toAccountId) {
      setErrorMsg('Vui lòng chọn tài khoản nhận (đích)');
      return;
    }

    if (fromAccountId === toAccountId) {
      setErrorMsg('Tài khoản nguồn và tài khoản đích phải khác nhau');
      return;
    }

    const fromAcc = accounts.find((a) => a.id === fromAccountId);
    const toAcc = accounts.find((a) => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      setErrorMsg('Tài khoản đã chọn không tồn tại');
      return;
    }

    if (fromAcc.currency_code !== toAcc.currency_code) {
      setErrorMsg(
        'Chuyển tiền khác loại tiền tệ sẽ được hỗ trợ trong Phase 8. Vui lòng chọn 2 tài khoản cùng loại tiền tệ.'
      );
      return;
    }

    if (!isPositiveExactDecimal(amount)) {
      setErrorMsg('Số tiền phải là số dương hợp lệ (tối đa 4 chữ số thập phân)');
      return;
    }

    if (note && note.length > 1000) {
      setErrorMsg('Ghi chú không được vượt quá 1000 ký tự');
      return;
    }

    try {
      setLoading(true);
      const exactAmount = toExactDecimal(amount);

      if (initialData) {
        await updateTransfer(initialData.id, {
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: exactAmount,
          currency_code: fromAcc.currency_code,
          note: note.trim() || null,
          occurred_on: occurredOn,
        });
      } else {
        await createTransfer({
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
          amount: exactAmount,
          currency_code: fromAcc.currency_code,
          note: note.trim() || null,
          occurred_on: occurredOn,
        });
      }

      setSubmitted(true);
      if (onSuccess) {
        await onSuccess();
      }
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu giao dịch chuyển tiền');
    } finally {
      setLoading(false);
    }
  };

  const handleVoid = async () => {
    if (!initialData) return;
    if (!confirm('Bạn có chắc chắn muốn hủy giao dịch chuyển tiền này? Số dư cả 2 tài khoản sẽ được hoàn tác.')) {
      return;
    }

    try {
      setLoading(true);
      setErrorMsg('');
      await voidTransfer(initialData.id);
      if (onSuccess) {
        await onSuccess();
      }
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Không thể hủy giao dịch');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!initialData) return;
    try {
      setLoading(true);
      setErrorMsg('');
      await restoreTransfer(initialData.id);
      if (onSuccess) {
        await onSuccess();
      }
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : 'Không thể khôi phục giao dịch');
    } finally {
      setLoading(false);
    }
  };

  const hasCompatibleDestinations = availableToAccounts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center space-x-2 text-primary">
            <ArrowRightLeft className="h-5 w-5" />
            <DialogTitle>{initialData ? 'Sửa chuyển tiền' : 'Chuyển tiền giữa các tài khoản'}</DialogTitle>
          </div>
          <DialogDescription>
            Chuyển tiền nội bộ giữa các tài khoản cùng loại tiền tệ. Không làm thay đổi tổng tài sản ròng.
          </DialogDescription>
        </DialogHeader>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 text-xs bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {submitted ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-2 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-12 w-12 animate-in zoom-in-50" />
            <p className="font-semibold text-base">Đã lưu giao dịch chuyển tiền thành công!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* From Account & To Account */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="from-account" className="text-xs font-semibold">
                  Tài khoản nguồn (Từ) <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="from-account"
                  value={fromAccountId}
                  onChange={(e) => handleFromAccountChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="" disabled>-- Chọn tài khoản --</option>
                  {availableFromAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency_code}){a.is_archived ? ' [Lưu trữ]' : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="to-account" className="text-xs font-semibold">
                  Tài khoản đích (Đến) <span className="text-destructive">*</span>
                </Label>
                <Select
                  id="to-account"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  disabled={loading || !hasCompatibleDestinations}
                >
                  <option value="" disabled>
                    {hasCompatibleDestinations ? '-- Chọn tài khoản --' : '-- Không có tài khoản cùng loại tiền --'}
                  </option>
                  {availableToAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency_code}){a.is_archived ? ' [Lưu trữ]' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {selectedFromAccount && !hasCompatibleDestinations && (
              <div className="p-3 text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/20">
                Chưa có tài khoản đích nào khác sử dụng loại tiền <strong>{selectedFromAccount.currency_code}</strong>.
                Chuyển tiền khác loại tiền tệ (đa ngoại tệ) sẽ được hỗ trợ trong Phase 8.
              </div>
            )}

            {/* Amount & Currency Display */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="transfer-amount" className="text-xs font-semibold">
                  Số tiền chuyển <span className="text-destructive">*</span>
                </Label>
                {selectedFromAccount && (
                  <span className="text-xs font-medium text-muted-foreground">
                    Loại tiền: <strong className="text-foreground">{selectedFromAccount.currency_code}</strong>
                  </span>
                )}
              </div>
              <div className="relative">
                <MoneyInput
                  id="transfer-amount"
                  currencyCode={selectedFromAccount ? selectedFromAccount.currency_code : 'VND'}
                  placeholder={selectedFromAccount?.currency_code === 'VND' ? '50.000' : '0.00'}
                  value={amount}
                  onChange={(val) => setAmount(val)}
                  disabled={loading}
                  className="pr-16 text-lg font-bold"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground pointer-events-none">
                  {selectedFromAccount ? selectedFromAccount.currency_code : 'VND'}
                </div>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="occurred-on" className="text-xs font-semibold">
                Ngày thực hiện <span className="text-destructive">*</span>
              </Label>
              <Input
                id="occurred-on"
                type="date"
                value={occurredOn}
                onChange={(e) => setOccurredOn(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label htmlFor="transfer-note" className="text-xs font-semibold">
                Ghi chú (Tùy chọn)
              </Label>
              <Input
                id="transfer-note"
                type="text"
                placeholder="VD: Rút tiền mặt chi tiêu, nạp ví điện tử..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={loading}
                maxLength={1000}
              />
            </div>

            {/* Void Status & Action if editing */}
            {initialData && (
              <div className="pt-2 flex items-center justify-between border-t">
                {initialData.is_voided ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-destructive font-semibold bg-destructive/10 px-2 py-1 rounded">
                      Giao dịch đã bị hủy
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleRestore}
                      disabled={loading}
                      className="text-xs h-8"
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Khôi phục giao dịch
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleVoid}
                    disabled={loading}
                    className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30 h-8"
                  >
                    <Ban className="h-3.5 w-3.5 mr-1" />
                    Hủy giao dịch chuyển tiền
                  </Button>
                )}
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Đóng
              </Button>
              <Button
                type="submit"
                disabled={loading || !hasCompatibleDestinations}
              >
                {loading ? 'Đang lưu...' : initialData ? 'Cập nhật' : 'Xác nhận chuyển'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
