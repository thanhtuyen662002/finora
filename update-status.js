const fs = require('fs');
let content = fs.readFileSync('docs/PROJECT_STATUS.md', 'utf8');

content = content.replace("PHASE_3_CODE=<PASS only after this corrective pass verifies locally>", "PHASE_3_CODE=PASS");
content = content.replace("PHASE_3_OVERALL=PARTIAL", "PHASE_3_OVERALL=PARTIAL");
content = content.replace("- **Phase 3 Initial Implementation Source:** CORRECTIVE_REQUIRED", "- **Phase 3 Initial Implementation Source:** CORRECTED");
content = content.replace("- **Phase 3 Corrective Code Gate:** PENDING", "- **Phase 3 Corrective Code Gate:** PASS");

fs.writeFileSync('docs/PROJECT_STATUS.md', content);
