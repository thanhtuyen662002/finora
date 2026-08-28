const fs = require('fs');
let content = fs.readFileSync('src/components/finance/AddCategoryModal.tsx', 'utf8');

content = content.replace("const [type, setType] = useState(defaultType);", "const [type, setType] = useState(initialData?.type || defaultType);");
content = content.replace("const [icon, setIcon] = useState('Tag');", "const [icon, setIcon] = useState(initialData?.icon || 'Tag');");
content = content.replace("const [color, setColor] = useState('#8b5cf6');", "const [color, setColor] = useState(initialData?.color || '#8b5cf6');");

content = content.replace(/Tạo danh mục mới để phân loại giao dịch của bạn\./, '{initialData ? "Chỉnh sửa thông tin danh mục." : "Tạo danh mục mới để phân loại giao dịch của bạn."}');
content = content.replace(/\{submitted \? 'Đang tạo\.\.\.' : 'Lưu danh mục'\}/, '{submitted ? (initialData ? "Đang lưu..." : "Đang tạo...") : (initialData ? "Lưu thay đổi" : "Tạo danh mục")}');

fs.writeFileSync('src/components/finance/AddCategoryModal.tsx', content);
