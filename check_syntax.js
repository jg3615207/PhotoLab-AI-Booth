const fs = require('fs');
const html = fs.readFileSync('kiosk/admin.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (match) {
  const code = match[1];
  try {
    const vm = require('vm');
    new vm.Script(code);
    console.log("Syntax is OK!");
  } catch (e) {
    console.error("Syntax Error found in admin.html script:");
    console.error(e);
  }
} else {
  console.error("Could not find the main script block.");
}
