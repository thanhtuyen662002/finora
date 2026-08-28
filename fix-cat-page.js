const fs = require('fs');
let content = fs.readFileSync('src/app/settings/categories/page.tsx', 'utf8');

content = content.replace("const [isAddModalOpen, setIsAddModalOpen] = useState(false);", "const [isAddModalOpen, setIsAddModalOpen] = useState(false);\n  const [editCategory, setEditCategory] = useState<CategoryRow | null>(null);\n  const [showArchived, setShowArchived] = useState(false);");

content = content.replace(/const handleArchive = async \(id: string\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?\}[\s\S]*?\};/, `const handleArchive = async (id: string, archive: boolean) => {
    if (archive && !confirm('Bạn có chắc chắn muốn lưu trữ danh mục này?')) return;
    try {
      await updateCategory(id, { is_archived: archive });
      await loadCategories();
    } catch (err) {
      console.error(err);
    }
  };`);

content = content.replace(/const handleCreate = async \(newCat: Omit<CategoryInsert, 'user_id'>\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?\}[\s\S]*?\};/, `const handleCreate = async (newCat: Omit<CategoryInsert, 'user_id'> | import('@/types/database').CategoryUpdate) => {
    if (editCategory) {
      await updateCategory(editCategory.id, newCat as import('@/types/database').CategoryUpdate);
    } else {
      await createCategory(newCat as Omit<CategoryInsert, 'user_id'>);
    }
    await loadCategories();
    setEditCategory(null);
  };`);

content = content.replace("const activeCategories = categories.filter(c => !c.is_archived);", "const activeCategories = categories.filter(c => !c.is_archived);\n  const archivedCategories = categories.filter(c => c.is_archived);\n  const categoriesToShow = showArchived ? archivedCategories : activeCategories;");
content = content.replace("const incomeCategories = activeCategories.filter(c => c.type === 'INCOME');", "const incomeCategories = categoriesToShow.filter(c => c.type === 'INCOME');");
content = content.replace("const expenseCategories = activeCategories.filter(c => c.type === 'EXPENSE');", "const expenseCategories = categoriesToShow.filter(c => c.type === 'EXPENSE');");

content = content.replace(/<div className="flex items-center space-x-2">/, `<div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hiện đang hoạt động' : 'Hiện đã lưu trữ'}
          </Button>`);

content = content.replace(/<Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-destructive" onClick=\{\(\) => handleArchive\(cat\.id\)\}>\n                      Xóa\n                    <\/Button>/g, `<div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-primary" onClick={() => { setEditCategory(cat); setIsAddModalOpen(true); }}>
                        Sửa
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={() => handleArchive(cat.id, !showArchived)}>
                        {showArchived ? 'Khôi phục' : 'Lưu trữ'}
                      </Button>
                    </div>`);

content = content.replace(/<AddCategoryModal[\s\S]*?\/>/, `<AddCategoryModal
        open={isAddModalOpen}
        onOpenChange={(open) => { setIsAddModalOpen(open); if (!open) setEditCategory(null); }}
        onSuccess={handleCreate}
        initialData={editCategory}
      />`);

fs.writeFileSync('src/app/settings/categories/page.tsx', content);
