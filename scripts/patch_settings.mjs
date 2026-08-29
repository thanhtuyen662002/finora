import fs from 'fs';
const file = 'src/app/settings/page.tsx';
let content = fs.readFileSync(file, 'utf-8');

// Update fetchSettings
content = content.replace(
  'setAppearanceTheme(settingsData.theme || \'system\');',
  'setAppearanceTheme(settingsData.theme || \'system\');\n      if (settingsData.auto_fx_enabled !== undefined) { setAutoFx(settingsData.auto_fx_enabled); }'
);

// Update handleSave
content = content.replace(
  'theme: appearanceTheme,',
  'theme: appearanceTheme,\n        auto_fx_enabled: autoFx,'
);

fs.writeFileSync(file, content);
