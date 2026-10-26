const fs = require('fs');
const path = require('path');

const baseDir = __dirname;
let html = fs.readFileSync(path.join(baseDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(baseDir, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(baseDir, 'app.js'), 'utf8');

html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');
html = html.replace('<script src="app.js"></script>', '<script>\n' + js + '\n</script>');

// Also add a direct Download App button in the header so phone users can download with 1 click
const downloadBtnSnippet = `
        <a href="/facecount-ai-app.zip" class="icon-btn" title="Download App ZIP" download="facecount-ai-app.zip" style="text-decoration:none;">
          <span class="icon">📥</span>
        </a>
`;
html = html.replace('<!-- Quick Action Icons -->\n      <div class="header-actions">', '<!-- Quick Action Icons -->\n      <div class="header-actions">' + downloadBtnSnippet);

fs.writeFileSync(path.join(baseDir, 'facecount-ai-app.html'), html, 'utf8');
console.log('Successfully bundled facecount-ai-app.html! File size:', fs.statSync(path.join(baseDir, 'facecount-ai-app.html')).size);
