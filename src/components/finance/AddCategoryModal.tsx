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
import type { CategoryRow, CategoryInsert, CategoryUpdate, CategoryType } from '@/types/database';

interface AddCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (categoryData: Omit<CategoryInsert, 'user_id'> | CategoryUpdate) => Promise<void>;
  initialData?: CategoryRow | null;
  defaultType?: CategoryType;
}

export const AddCategoryModal: React.FC<AddCategoryModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
  defaultType = 'EXPENSE',
  initialData
}) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<CategoryType>(defaultType);
  const [icon, setIcon] = useState('Tag');
  const [color, setColor] = useState('#8b5cf6');
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
    if (open) {
            if (initialData) {
        setName(initialData.name);
        setType(initialData.type as CategoryType);
        setIcon(initialData.icon);
        setColor(initialData.color);
      } else {
        setName('');
        setType(defaultType);
        setIcon('Tag');
        setColor('#8b5cf6');
      }
      setErrorMsg('');
      setSubmitted(false);
    }
  }, [open, initialData, defaultType]);

  const colors = [
    '#f97316', '#0ea5e9', '#8b5cf6', '#ef4444', 
    '#ec4899', '#10b981', '#64748b', '#22c55e', 
    '#dc2626', '#3b82f6', '#14b8a6'
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
          icon,
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
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <PlusCircle className="h-5 w-5 text-primary" />
            <span>{initialData ? "Sửa danh mục" : "Thêm danh mục"}</span>
          </DialogTitle>
          <DialogDescription>
            {initialData ? "Chỉnh sửa thông tin danh mục." : "Tạo danh mục mới để phân loại giao dịch của bạn."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {errorMsg && <div className="text-sm font-medium text-destructive">{errorMsg}</div>}
          <div className="space-y-1.5">
            <Label htmlFor="catName">Tên danh mục</Label>
            <Input
              id="catName"
              placeholder="Ví dụ: Ăn uống, Lương..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catType">Loại danh mục</Label>
            <Select
              id="catType"
              value={type}
              onChange={(e) => setType(e.target.value as CategoryType)}
              options={[
                { value: 'EXPENSE', label: 'Chi tiêu' },
                { value: 'INCOME', label: 'Thu nhập' },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="catIcon">Biểu tượng (Icon)</Label>
            <Select
              id="catIcon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              options={[
                { value: 'Utensils', label: 'Ăn uống' },
                { value: 'Car', label: 'Di chuyển' },
                { value: 'ShoppingBag', label: 'Mua sắm' },
                { value: 'Home', label: 'Nhà cửa' },
                { value: 'Film', label: 'Giải trí' },
                { value: 'HeartPulse', label: 'Sức khỏe' },
                { value: 'Briefcase', label: 'Công việc/Lương' },
                { value: 'Video', label: 'Video/Media' },
                { value: 'Laptop', label: 'Công nghệ' },
                { value: 'TrendingUp', label: 'Đầu tư' },
                { value: 'Tag', label: 'Nhãn (Tag)' },
                { value: 'MoreHorizontal', label: 'Khác' },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Màu sắc</Label>
            <div className="flex flex-wrap gap-2 pt-1">
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
              {submitted ? (initialData ? "Đang lưu..." : "Đang tạo...") : (initialData ? "Lưu thay đổi" : "Tạo danh mục")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
