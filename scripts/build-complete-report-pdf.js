const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

async function buildPdfWithDiagrams() {
  const mdPath = path.resolve(__dirname, '../docs/PROJECT_REPORT.md');
  const htmlOutPath = path.resolve(__dirname, '../docs/PROJECT_REPORT_RENDERED.html');
  const pdfOutPath = path.resolve(__dirname, '../docs/PROJECT_REPORT.pdf');
  const desktopOutPath = 'C:\\Users\\asus\\OneDrive\\Desktop\\PROJECT_REPORT.pdf';

  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const mermaidJs = fs.readFileSync(path.resolve(__dirname, 'mermaid.min.js'), 'utf8');

  // Simple and robust parser for markdown to HTML
  const lines = mdContent.split('\n');
  let htmlBody = '';

  let inTable = false;
  let tableRows = [];
  let inCodeBlock = false;
  let codeBlockType = '';
  let codeLines = [];

  function flushTable() {
    if (tableRows.length > 0) {
      let tHtml = '<div class="table-container"><table><thead><tr>';
      tableRows[0].forEach(cell => {
        tHtml += `<th>${cell.trim().replace(/\*\*/g, '')}</th>`;
      });
      tHtml += '</tr></thead><tbody>';

      for (let r = 1; r < tableRows.length; r++) {
        tHtml += '<tr>';
        tableRows[r].forEach((cell, cIdx) => {
          let clean = cell.trim().replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>').replace(/`/g, '<code>').replace(/`/g, '</code>');
          if (clean.includes('Verified')) {
            clean = `<span class="badge-verified">${clean}</span>`;
          } else if (clean.includes('Live')) {
            clean = `<span class="badge-live">${clean}</span>`;
          }
          tHtml += `<td>${clean}</td>`;
        });
        tHtml += '</tr>';
      }
      tHtml += '</tbody></table></div>';
      htmlBody += tHtml;
      tableRows = [];
    }
    inTable = false;
  }

  function flushCodeBlock() {
    if (codeBlockType === 'mermaid') {
      htmlBody += `<div class="diagram-wrapper"><div class="diagram-label">Visual System Flow Diagram</div><div class="mermaid">\n${codeLines.join('\n')}\n</div></div>`;
    } else {
      const escaped = codeLines.join('\n')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      htmlBody += `<pre><code>${escaped}</code></pre>`;
    }
    codeLines = [];
    inCodeBlock = false;
    codeBlockType = '';
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line.startsWith('```')) {
      if (inTable) flushTable();
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        inCodeBlock = true;
        codeBlockType = line.replace('```', '').trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(rawLine);
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      if (line.includes('---')) continue;
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
      inTable = true;
      continue;
    } else {
      if (inTable) flushTable();
    }

    if (!line) {
      continue;
    }

    if (line === '---') {
      htmlBody += '<hr/>';
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      htmlBody += `<h1>${line.replace('# ', '')}</h1>`;
    } else if (line.startsWith('## ')) {
      htmlBody += `<h2>${line.replace('## ', '')}</h2>`;
    } else if (line.startsWith('### ')) {
      htmlBody += `<h3>${line.replace('### ', '')}</h3>`;
    } else if (line.startsWith('#### ')) {
      htmlBody += `<h4>${line.replace('#### ', '')}</h4>`;
    } else if (line.startsWith('> ')) {
      htmlBody += `<div class="callout">${line.replace('> ', '').replace(/\*\*/g, '<strong>').replace(/\*\*/g, '</strong>')}</div>`;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      let bText = line.substring(2)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
      htmlBody += `<ul><li>${bText}</li></ul>`;
    } else if (/^\d+\.\s/.test(line)) {
      let nText = line.replace(/^\d+\.\s/, '')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
      htmlBody += `<ol><li>${nText}</li></ol>`;
    } else {
      let pText = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
      htmlBody += `<p>${pText}</p>`;
    }
  }

  if (inTable) flushTable();
  if (inCodeBlock) flushCodeBlock();

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VorldX Employee Attendance System — Final Technical Project Report</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
      @bottom-right {
        content: "Page " counter(page);
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #1e293b;
      background: #ffffff;
      padding: 0 10px;
    }
    h1 {
      font-size: 20pt;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 8pt;
      line-height: 1.25;
      border-bottom: 2pt solid #2563eb;
      padding-bottom: 6pt;
    }
    h2 {
      font-size: 13pt;
      font-weight: 700;
      color: #1d4ed8;
      margin-top: 18pt;
      margin-bottom: 8pt;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 4pt;
      page-break-after: avoid;
    }
    h3 {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
      margin-top: 12pt;
      margin-bottom: 6pt;
      page-break-after: avoid;
    }
    h4 {
      font-size: 10pt;
      font-weight: 700;
      color: #334155;
      margin-top: 8pt;
      margin-bottom: 4pt;
    }
    p { margin-bottom: 8pt; color: #334155; }
    hr { border: none; border-top: 1px solid #e2e8f0; margin: 14pt 0; }
    ul, ol { margin-left: 20pt; margin-bottom: 8pt; color: #334155; }
    li { margin-bottom: 3pt; }
    code {
      font-family: "Courier New", Courier, monospace;
      font-size: 8.5pt;
      background: #f1f5f9;
      color: #0f172a;
      padding: 1pt 3pt;
      border-radius: 3pt;
      border: 1px solid #e2e8f0;
    }
    pre {
      background: #0f172a;
      color: #f8fafc;
      padding: 10pt;
      border-radius: 5pt;
      font-family: "Courier New", Courier, monospace;
      font-size: 7.5pt;
      line-height: 1.45;
      margin: 10pt 0;
      page-break-inside: avoid;
      overflow-x: hidden;
      white-space: pre-wrap;
    }
    pre code { background: transparent; color: inherit; border: none; padding: 0; font-size: inherit; }
    .table-container {
      width: 100%;
      margin: 12pt 0;
      page-break-inside: avoid;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7.5pt;
      margin-bottom: 8pt;
      border: 1px solid #cbd5e1;
    }
    th {
      background: #1e293b;
      color: #ffffff;
      padding: 5pt 6pt;
      font-weight: 700;
      text-align: left;
      border: 1px solid #cbd5e1;
    }
    td {
      padding: 4.5pt 6pt;
      border: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: top;
    }
    tr:nth-child(even) { background: #f8fafc; }
    .badge-verified {
      background: #d1fae5;
      color: #065f46;
      padding: 1.5pt 4pt;
      border-radius: 3pt;
      font-weight: 700;
      font-size: 7pt;
      display: inline-block;
      border: 1px solid #a7f3d0;
    }
    .badge-live {
      background: #dbeafe;
      color: #1e40af;
      padding: 1.5pt 4pt;
      border-radius: 3pt;
      font-weight: 700;
      font-size: 7pt;
      display: inline-block;
      border: 1px solid #bfdbfe;
    }
    .callout {
      background: #eff6ff;
      border-left: 3pt solid #2563eb;
      padding: 8pt 10pt;
      margin: 10pt 0;
      font-size: 8.5pt;
      color: #1e40af;
      border-radius: 0 4pt 4pt 0;
      page-break-inside: avoid;
    }
    .diagram-wrapper {
      margin: 14pt 0;
      padding: 12pt;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6pt;
      page-break-inside: avoid;
      text-align: center;
    }
    .diagram-label {
      font-size: 8.5pt;
      font-weight: 700;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8pt;
      text-align: left;
    }
    .mermaid {
      display: flex;
      justify-content: center;
      margin: 0 auto;
    }
    .mermaid svg {
      max-width: 100% !important;
      height: auto !important;
    }
  </style>
</head>
<body>
  ${htmlBody}
  <script>${mermaidJs}</script>
  <script>
    mermaid.initialize({
      startOnLoad: true,
      theme: 'neutral',
      flowchart: { curve: 'linear' },
      securityLevel: 'loose'
    });
  </script>
</body>
</html>`;

  fs.writeFileSync(htmlOutPath, fullHtml);
  console.log('Saved rendered HTML at ' + htmlOutPath);

  // Launch Puppeteer to render to PDF
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('file:///' + htmlOutPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle0',
    timeout: 30000
  });

  // Wait for Mermaid SVGs to finish rendering
  try {
    await page.waitForSelector('.mermaid svg', { timeout: 10000 });
    console.log('Mermaid SVGs rendered successfully');
  } catch (e) {
    console.log('Waiting timeout or no mermaid elements, proceeding');
  }

  // Small delay to ensure all layouts settle
  await new Promise(r => setTimeout(r, 1500));

  await page.pdf({
    path: pdfOutPath,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size: 7.5pt; color: #94a3b8; width: 100%; text-align: right; padding-right: 15mm; font-family: sans-serif;">VorldX Employee Attendance System — Final Technical Project Report</div>',
    footerTemplate: '<div style="font-size: 7.5pt; color: #94a3b8; width: 100%; text-align: center; font-family: sans-serif;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
    margin: {
      top: '18mm',
      bottom: '18mm',
      left: '14mm',
      right: '14mm'
    }
  });

  await browser.close();
  console.log('SUCCESS: Generated PDF with Flow Diagrams at ' + pdfOutPath + ' (' + fs.statSync(pdfOutPath).size + ' bytes)');

  // Copy directly to desktop
  fs.copyFileSync(pdfOutPath, desktopOutPath);
  console.log('COPIED TO DESKTOP: ' + desktopOutPath);
}

buildPdfWithDiagrams().catch(err => {
  console.error('Build Error:', err);
  process.exit(1);
});
