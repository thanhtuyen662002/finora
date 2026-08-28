const fs = require('fs');
let content = fs.readFileSync('src/components/finance/AddCategoryModal.tsx', 'utf8');

content = content.replace("onSuccess?: (categoryData: any) => void;", "onSuccess?: (categoryData: Omit<import('@/types/database').CategoryInsert, 'user_id'> | import('@/types/database').CategoryUpdate) => Promise<void>;\n  initialData?: any;");

content = content.replace("}) => {", "  initialData\n}) => {");

content = content.replace("const [name, setName] = useState('');", "const [name, setName] = useState(initialData?.name || '');");
content = content.replace("const [type, setType] = useState('EXPENSE');", "const [type, setType] = useState(initialData?.type || 'EXPENSE');");
content = content.replace("const [icon, setIcon] = useState('CircleDashed');", "const [icon, setIcon] = useState(initialData?.icon || 'CircleDashed');");
content = content.replace("const [color, setColor] = useState('#64748b');", "const [color, setColor] = useState(initialData?.color || '#64748b');");
content = content.replace("const [submitted, setSubmitted] = useState(false);", "const [submitted, setSubmitted] = useState(false);\n  const [errorMsg, setErrorMsg] = useState('');");

content = content.replace("const handleSubmit = (e: React.FormEvent) => {", "const handleSubmit = async (e: React.FormEvent) => {");

content = content.replace(/try {[\s\S]*?setSubmitted\(false\);\n    }/, `try {
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
      if (!initialData) {
        setName('');
        setIcon('CircleDashed');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra');
      setSubmitted(false);
    }`);

content = content.replace(/<form onSubmit=\{handleSubmit\} className="space-y-4 py-2">/, '<form onSubmit={handleSubmit} className="space-y-4 py-2">\n          {errorMsg && <div className="text-sm font-medium text-destructive">{errorMsg}</div>}');
content = content.replace(/<span>Thêm danh mục<\/span>/, '<span>{initialData ? "Sửa danh mục" : "Thêm danh mục"}</span>');
content = content.replace(/Tạo danh mục phân loại thu chi mới\./, '{initialData ? "Chỉnh sửa thông tin danh mục." : "Tạo danh mục phân loại thu chi mới."}');
content = content.replace(/'Tạo danh mục'/, 'initialData ? "Lưu thay đổi" : "Tạo danh mục"');

fs.writeFileSync('src/components/finance/AddCategoryModal.tsx', content);
