const fs = require('fs');
let content = fs.readFileSync('src/components/finance/AddAccountModal.tsx', 'utf8');

content = content.replace("onSuccess?: (accountData: any) => void;", "onSuccess?: (accountData: Omit<import('@/types/database').AccountInsert, 'user_id'> | import('@/types/database').AccountUpdate) => Promise<void>;\n  initialData?: any;");

content = content.replace("}) => {", "  initialData\n}) => {");

content = content.replace("const [name, setName] = useState('');", "const [name, setName] = useState(initialData?.name || '');");
content = content.replace("const [type, setType] = useState('BANK');", "const [type, setType] = useState(initialData?.type || 'BANK');");
content = content.replace("const [currencyCode, setCurrencyCode] = useState('VND');", "const [currencyCode, setCurrencyCode] = useState(initialData?.currency_code || 'VND');");
content = content.replace("const [balance, setBalance] = useState('');", "const [balance, setBalance] = useState(initialData?.opening_balance?.toString() || '');");
content = content.replace("const [institution, setInstitution] = useState('');", "const [institution, setInstitution] = useState(initialData?.institution || '');");
content = content.replace("const [color, setColor] = useState('#005a3c');", "const [color, setColor] = useState(initialData?.color || '#005a3c');");
content = content.replace("const [submitted, setSubmitted] = useState(false);", "const [submitted, setSubmitted] = useState(false);\n  const [errorMsg, setErrorMsg] = useState('');");

content = content.replace("const handleSubmit = (e: React.FormEvent) => {", "const handleSubmit = async (e: React.FormEvent) => {");

content = content.replace(/try {[\s\S]*?setSubmitted\(false\);\n    }/, `try {
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
    }`);

content = content.replace(/<form onSubmit=\{handleSubmit\} className="space-y-4 py-2">/, '<form onSubmit={handleSubmit} className="space-y-4 py-2">\n          {errorMsg && <div className="text-sm font-medium text-destructive">{errorMsg}</div>}');
content = content.replace(/<span>Thêm tài khoản \/ ví<\/span>/, '<span>{initialData ? "Sửa tài khoản" : "Thêm tài khoản / ví"}</span>');
content = content.replace(/Tạo tài khoản ngân hàng, ví điện tử hoặc quỹ tiền mặt để quản lý\./, '{initialData ? "Chỉnh sửa thông tin tài khoản." : "Tạo tài khoản ngân hàng, ví điện tử hoặc quỹ tiền mặt để quản lý."}');
content = content.replace(/'Tạo tài khoản'/, 'initialData ? "Lưu thay đổi" : "Tạo tài khoản"');

fs.writeFileSync('src/components/finance/AddAccountModal.tsx', content);
