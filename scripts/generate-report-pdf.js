const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

function createPdf() {
  const mdPath = path.resolve(__dirname, '../project-report/Attendance_Tracker_Project_Report.md');
  const outPath = path.resolve(__dirname, '../project-report/Attendance_Tracker_Project_Report.pdf');
  const content = fs.readFileSync(mdPath, 'utf8');

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
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
      const colWidth = 495 / colCount;

      tableRows.forEach((row, rIdx) => {
        const isHeader = rIdx === 0;
        const rowY = doc.y;

        // Check if row fits on current page
        if (rowY > 730) {
          doc.addPage();
        }

        const currentY = doc.y;
        const rowHeight = 18;

        // Background
        doc.rect(50, currentY, 495, rowHeight)
           .fill(isHeader ? '#E2E8F0' : (rIdx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'));

        // Cells
        row.forEach((cell, cIdx) => {
          const cellX = 52 + cIdx * colWidth;
          const cleanCell = cell.trim().replace(/\*\*/g, '');
          doc.fillColor(isHeader ? '#0F172A' : '#334155')
             .fontSize(isHeader ? 7.5 : 7)
             .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
             .text(cleanCell, cellX, currentY + 4, {
               width: colWidth - 4,
               height: rowHeight - 4,
               ellipsis: true
             });
        });

        // Border bottom
        doc.rect(50, currentY + rowHeight, 495, 0.5).fill('#CBD5E1');
        doc.y = currentY + rowHeight + 1;
      });

      doc.moveDown(0.5);
      tableRows = [];
    }
    inTable = false;
  }

  function flushCodeBlock() {
    if (codeLines.length > 0) {
      if (doc.y > 680) {
        doc.addPage();
      }
      const codeText = codeLines.join('\n');
      const boxY = doc.y;
      
      doc.fillColor('#0F172A').fontSize(7.5).font('Courier');
      const textHeight = doc.heightOfString(codeText, { width: 485 });

      if (boxY + textHeight > 740) {
        doc.addPage();
      }

      const finalY = doc.y;
      doc.rect(50, finalY, 495, textHeight + 10).fillAndStroke('#F8FAFC', '#E2E8F0');
      doc.fillColor('#0F172A')
         .text(codeText, 55, finalY + 5, { width: 485 });

      doc.y = finalY + textHeight + 16;
      codeLines = [];
    }
    inCodeBlock = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (line === '\\newpage') {
      if (inTable) flushTable();
      if (inCodeBlock) flushCodeBlock();
      doc.addPage();
      continue;
    }

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

    // Page overflow safety
    if (doc.y > 740) {
      doc.addPage();
    }

    // Headings
    if (line.startsWith('# ')) {
      doc.moveDown(0.5);
      doc.fillColor('#0F172A').fontSize(16).font('Helvetica-Bold')
         .text(line.replace('# ', ''), { align: 'center' });
      doc.moveDown(0.4);
    } else if (line.startsWith('## ')) {
      doc.moveDown(0.8);
      doc.fillColor('#2563EB').fontSize(13).font('Helvetica-Bold')
         .text(line.replace('## ', ''));
      doc.rect(50, doc.y, 495, 1).fill('#E2E8F0');
      doc.moveDown(0.4);
    } else if (line.startsWith('### ')) {
      doc.moveDown(0.6);
      doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold')
         .text(line.replace('### ', ''));
      doc.moveDown(0.3);
    } else if (line.startsWith('#### ')) {
      doc.moveDown(0.4);
      doc.fillColor('#1E293B').fontSize(9.5).font('Helvetica-Bold')
         .text(line.replace('#### ', ''));
      doc.moveDown(0.2);
    } else if (line.startsWith('##### ')) {
      doc.moveDown(0.3);
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Bold')
         .text(line.replace('##### ', ''));
      doc.moveDown(0.2);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const cleanBullet = line.substring(2).replace(/\*\*/g, '').replace(/`/g, '');
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
         .text('•  ' + cleanBullet, 60, doc.y, { width: 480 });
      doc.moveDown(0.15);
    } else {
      const cleanText = line.replace(/\*\*/g, '').replace(/`/g, '');
      doc.fillColor('#1E293B').fontSize(8.5).font('Helvetica')
         .text(cleanText, 50, doc.y, { width: 495, lineGap: 2 });
      doc.moveDown(0.3);
    }
  }

  if (inTable) flushTable();
  if (inCodeBlock) flushCodeBlock();

  // Add Page Headers & Numbers
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Header
    doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
       .text('Attendance Tracker: Design, Development and Implementation', 50, 30, { align: 'right', width: 495 });
    doc.rect(50, 42, 495, 0.5).fill('#E2E8F0');

    // Footer
    doc.rect(50, 792, 495, 0.5).fill('#E2E8F0');
    doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
       .text(`Page ${i + 1} of ${range.count}`, 50, 802, { align: 'center', width: 495 });
  }

  doc.end();

  stream.on('finish', () => {
    console.log(`SUCCESS: Generated PDF at ${outPath} (${fs.statSync(outPath).size} bytes, ${range.count} pages)`);
  });
}

createPdf();

