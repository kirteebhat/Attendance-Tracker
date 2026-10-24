const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function generateMarkdownPdf() {
  const mdPath = path.resolve(__dirname, '../docs/PROJECT_REPORT.md');
  const outPath = path.resolve(__dirname, '../docs/PROJECT_REPORT.pdf');
  const content = fs.readFileSync(mdPath, 'utf8');

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 45, bottom: 45, left: 45, right: 45 },
    bufferPages: true
  });

  const stream = fs.createWriteStream(outPath);
  doc.pipe(stream);

  const lines = content.split('\n');

  let inTable = false;
  let tableRows = [];
  let inCodeBlock = false;
  let codeLines = [];

  function flushTable() {
    if (tableRows.length > 0) {
      const colCount = Math.max(...tableRows.map(r => r.length));
      
      // Calculate column widths based on column count and type
      let colWidths = [];
      if (colCount === 6) {
        // Requirements table: ID, Requirement, Source, Module, Evidence, Status
        colWidths = [45, 130, 60, 55, 165, 50];
      } else if (colCount === 4) {
        // Test suite table: Workspace, Suite, Tests Passed, Tests Failed, Duration / Cloud deployment table
        colWidths = [120, 150, 155, 80];
      } else {
        const stdWidth = 505 / colCount;
        colWidths = Array(colCount).fill(stdWidth);
      }

      tableRows.forEach((row, rIdx) => {
        const isHeader = rIdx === 0;

        // Check if row fits on current page
        if (doc.y > 740) {
          doc.addPage();
        }

        const currentY = doc.y;
        const rowHeight = isHeader ? 18 : 20;

        // Background fill
        doc.rect(45, currentY, 505, rowHeight)
           .fill(isHeader ? '#1E293B' : (rIdx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'));

        // Cell contents
        let currentX = 45;
        row.forEach((cell, cIdx) => {
          const width = colWidths[cIdx] || 60;
          const cleanCell = cell.trim().replace(/\*\*/g, '').replace(/`/g, '');
          const isVerified = cleanCell.includes('Verified') || cleanCell.includes('Live') || cleanCell.includes('OK');

          let textColor = isHeader ? '#FFFFFF' : '#334155';
          if (!isHeader && isVerified) {
            textColor = '#059669'; // Green for verified
          }

          doc.fillColor(textColor)
             .fontSize(isHeader ? 7.5 : 7)
             .font(isHeader ? 'Helvetica-Bold' : (isVerified ? 'Helvetica-Bold' : 'Helvetica'))
             .text(cleanCell, currentX + 3, currentY + 4, {
               width: width - 6,
               height: rowHeight - 6,
               ellipsis: true
             });

          currentX += width;
        });

        // Bottom border
        doc.rect(45, currentY + rowHeight, 505, 0.5).fill('#E2E8F0');
        doc.y = currentY + rowHeight + 1;
      });

      doc.moveDown(0.6);
      tableRows = [];
    }
    inTable = false;
  }

  function flushCodeBlock() {
    if (codeLines.length > 0) {
      if (doc.y > 660) {
        doc.addPage();
      }
      const codeText = codeLines.join('\n');
      doc.fontSize(7).font('Courier');
      const textHeight = doc.heightOfString(codeText, { width: 495 });

      if (doc.y + textHeight > 750) {
        doc.addPage();
      }

      const finalY = doc.y;
      doc.rect(45, finalY, 505, textHeight + 10).fillAndStroke('#0F172A', '#1E293B');
      doc.fillColor('#F8FAFC')
         .text(codeText, 50, finalY + 5, { width: 495 });

      doc.y = finalY + textHeight + 15;
      codeLines = [];
    }
    inCodeBlock = false;
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
      doc.moveDown(0.3);
      continue;
    }

    if (line === '---') {
      if (doc.y > 750) doc.addPage();
      doc.rect(45, doc.y, 505, 1).fill('#E2E8F0');
      doc.moveDown(0.4);
      continue;
    }

    // Page overflow safety
    if (doc.y > 750) {
      doc.addPage();
    }

    // Headings
    if (line.startsWith('# ')) {
      doc.moveDown(0.4);
      doc.fillColor('#0F172A').fontSize(16).font('Helvetica-Bold')
         .text(line.replace('# ', ''));
      doc.moveDown(0.3);
    } else if (line.startsWith('## ')) {
      doc.moveDown(0.7);
      doc.fillColor('#2563EB').fontSize(12.5).font('Helvetica-Bold')
         .text(line.replace('## ', ''));
      doc.rect(45, doc.y, 505, 1).fill('#BFDBFE');
      doc.moveDown(0.4);
    } else if (line.startsWith('### ')) {
      doc.moveDown(0.5);
      doc.fillColor('#0F172A').fontSize(10.5).font('Helvetica-Bold')
         .text(line.replace('### ', ''));
      doc.moveDown(0.3);
    } else if (line.startsWith('#### ')) {
      doc.moveDown(0.3);
      doc.fillColor('#1E293B').fontSize(9).font('Helvetica-Bold')
         .text(line.replace('#### ', ''));
      doc.moveDown(0.2);
    } else if (line.startsWith('> ')) {
      // Callout box
      const calloutText = line.replace('> ', '').replace(/\*\*/g, '');
      const calloutHeight = doc.heightOfString(calloutText, { width: 485 }) + 8;
      const calloutY = doc.y;
      doc.rect(45, calloutY, 505, calloutHeight).fillAndStroke('#EFF6FF', '#BFDBFE');
      doc.rect(45, calloutY, 4, calloutHeight).fill('#2563EB');
      doc.fillColor('#1E40AF').fontSize(8).font('Helvetica')
         .text(calloutText, 55, calloutY + 4, { width: 485 });
      doc.y = calloutY + calloutHeight + 6;
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const cleanBullet = line.substring(2).replace(/\*\*/g, '').replace(/`/g, '');
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
         .text('•  ' + cleanBullet, 55, doc.y, { width: 495 });
      doc.moveDown(0.15);
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list
      const cleanNum = line.replace(/\*\*/g, '').replace(/`/g, '');
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
         .text(cleanNum, 55, doc.y, { width: 495 });
      doc.moveDown(0.2);
    } else {
      const cleanText = line.replace(/\*\*/g, '').replace(/`/g, '');
      doc.fillColor('#1E293B').fontSize(8.5).font('Helvetica')
         .text(cleanText, 45, doc.y, { width: 505, lineGap: 2 });
      doc.moveDown(0.3);
    }
  }

  if (inTable) flushTable();
  if (inCodeBlock) flushCodeBlock();

  // Add Headers & Footers across all pages
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Running Top Header
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica')
       .text('VorldX Employee Attendance System — Final Technical Project Report', 45, 24, { align: 'left', width: 350 });
    doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
       .text('CIN: U62099UP2026PTC245598', 400, 24, { align: 'right', width: 150 });
    doc.rect(45, 34, 505, 0.5).fill('#CBD5E1');

    // Running Bottom Footer
    doc.rect(45, 796, 505, 0.5).fill('#CBD5E1');
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica')
       .text('October 2026 Submission Candidate • 100% Production Verified', 45, 804, { align: 'left', width: 350 });
    doc.fillColor('#64748B').fontSize(7.5).font('Helvetica')
       .text(`Page ${i + 1} of ${range.count}`, 400, 804, { align: 'right', width: 150 });
  }

  doc.end();

  stream.on('finish', () => {
    console.log(`SUCCESS: Generated PDF at ${outPath} (${fs.statSync(outPath).size} bytes, ${range.count} pages)`);
  });
}

generateMarkdownPdf();
