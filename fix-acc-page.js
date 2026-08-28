const fs = require('fs');
let content = fs.readFileSync('src/app/accounts/page.tsx', 'utf8');

content = content.replace("const [addAccountOpen, setAddAccountOpen] = useState(false);", "const [addAccountOpen, setAddAccountOpen] = useState(false);\n  const [editAccount, setEditAccount] = useState<AccountRow | null>(null);\n  const [showArchived, setShowArchived] = useState(false);");

content = content.replace(/const handleCreateAccount = async \(newAcc: Omit<AccountInsert, 'user_id'>\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?\}[\s\S]*?\};/, `const handleCreateAccount = async (newAcc: Omit<AccountInsert, 'user_id'> | AccountUpdate) => {
    if (editAccount) {
      await updateAccount(editAccount.id, newAcc as AccountUpdate);
    } else {
      await createAccount(newAcc as Omit<AccountInsert, 'user_id'>);
    }
    await loadAccounts();
    setEditAccount(null);
  };`);

content = content.replace(/const handleArchiveAccount = async \(id: string\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?\}[\s\S]*?\};/, `const handleArchiveAccount = async (id: string, archive: boolean) => {
    if (archive && !confirm('Bạn có chắc chắn muốn lưu trữ tài khoản này?')) return;
    try {
      await updateAccount(id, { is_archived: archive });
      await loadAccounts();
    } catch (err) {
      console.error('Failed to update account archive status', err);
    }
  };`);

content = content.replace("const filteredAccounts = accounts.filter((a) => {", `const activeAccounts = accounts.filter(a => !a.is_archived);
  const archivedAccounts = accounts.filter(a => a.is_archived);
  const accountsToShow = showArchived ? archivedAccounts : activeAccounts;

  const filteredAccounts = accountsToShow.filter((a) => {`);

content = content.replace(/if \(a.is_archived\) return false;\n/g, "");

content = content.replace(/accounts.filter\(a => !a.is_archived\)\.length/g, "activeAccounts.length");

content = content.replace(/\{ value: 'SAVINGS', label: 'Sổ tiết kiệm' \},/g, `{ value: 'SAVINGS', label: 'Sổ tiết kiệm' },
          ]}`);

content = content.replace(/\]\}\n        \/\>/, "/>\n        <div className=\"flex items-center gap-2\">\n          <Button variant=\"outline\" size=\"sm\" onClick={() => setShowArchived(!showArchived)}>\n            {showArchived ? 'Hiện đang hoạt động' : 'Hiện đã lưu trữ'}\n          </Button>\n        </div>");

content = content.replace(/<Button variant="ghost" size="sm" onClick=\{\(\) => handleArchiveAccount\(acc.id\)\} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">[\s\S]*?Lưu trữ[\s\S]*?<\/Button>/, 
`<Button variant="ghost" size="sm" onClick={() => { setEditAccount(acc); setAddAccountOpen(true); }} className="h-8 px-2 text-xs text-muted-foreground hover:text-primary">
                  Sửa
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleArchiveAccount(acc.id, !showArchived)} className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive">
                  {showArchived ? 'Khôi phục' : 'Lưu trữ'}
                </Button>`);

content = content.replace(/<AddAccountModal[\s\S]*?\/>/, `<AddAccountModal
        open={addAccountOpen}
        onOpenChange={(open) => { setAddAccountOpen(open); if (!open) setEditAccount(null); }}
        onSuccess={handleCreateAccount}
        initialData={editAccount}
      />`);

fs.writeFileSync('src/app/accounts/page.tsx', content);
