"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/finance/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DynamicIcon } from '@/components/ui/DynamicIcon';
import { AddCategoryModal } from '@/components/finance/AddCategoryModal';
import { getCategories, createCategory, updateCategory } from '@/features/categories/categories';
import type { CategoryRow, CategoryInsert } from '@/types/database';
import { ArrowLeft, Plus } from 'lucide-react';

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCategories();
  }, []);

  const handleArchive = async (id: string) => {
    if (!confirm('Lưu trữ danh mục này?')) return;
    try {
      await updateCategory(id, { is_archived: true });
      await loadCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (newCat: Omit<CategoryInsert, 'user_id'>) => {
    try {
      await createCategory(newCat);
      await loadCategories();
    } catch (err) {
      console.error(err);
    }
  };

  const activeCategories = categories.filter(c => !c.is_archived);
  const incomeCategories = activeCategories.filter(c => c.type === 'INCOME');
  const expenseCategories = activeCategories.filter(c => c.type === 'EXPENSE');

  return (
    <AppShell>
      <PageHeader
        title="Danh mục thu chi"
        subtitle="Quản lý các danh mục phân loại cho thu nhập và chi tiêu."
      >
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/settings')}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Trở về
          </Button>
          <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Thêm danh mục
          </Button>
        </div>
      </PageHeader>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Đang tải danh mục...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <div>
            <h3 className="font-semibold text-lg mb-3">Danh mục Chi tiêu</h3>
            <div className="space-y-2">
              {expenseCategories.map(cat => (
                <Card key={cat.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                        <DynamicIcon name={cat.icon} size={16} />
                      </div>
                      <span className="font-medium text-sm">{cat.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => handleArchive(cat.id)}>
                      Xóa
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-lg mb-3">Danh mục Thu nhập</h3>
            <div className="space-y-2">
              {incomeCategories.map(cat => (
                <Card key={cat.id}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: cat.color + '20', color: cat.color }}>
                        <DynamicIcon name={cat.icon} size={16} />
                      </div>
                      <span className="font-medium text-sm">{cat.name}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick={() => handleArchive(cat.id)}>
                      Xóa
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      <AddCategoryModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSuccess={handleCreate}
      />
    </AppShell>
  );
}
