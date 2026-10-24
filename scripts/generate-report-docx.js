const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat
} = require('docx');

async function createDocx() {
  const mdPath = path.resolve(__dirname, '../project-report/Attendance_Tracker_Project_Report.md');
  const outPath = path.resolve(__dirname, '../project-report/Attendance_Tracker_Project_Report.docx');
  const content = fs.readFileSync(mdPath, 'utf8');

  const lines = content.split('\n');
  const children = [];

  let inTable = false;
  let tableRows = [];
  let inCodeBlock = false;
  let codeLines = [];

  function flushTable() {
    if (tableRows.length > 0) {
      const docxRows = tableRows.map((row, rIdx) => {
        return new TableRow({
          tableHeader: rIdx === 0,
          children: row.map(cellText => {
            return new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: cellText.trim(),
                      bold: rIdx === 0,
                      size: 19,
                      color: rIdx === 0 ? '0F172A' : '334155'
                    })
                  ]
                })
              ],
              shading: {
                fill: rIdx === 0 ? 'F1F5F9' : (rIdx % 2 === 0 ? 'FAFAFA' : 'FFFFFF')
              },
              margins: { top: 120, bottom: 120, left: 160, right: 160 }
            });
          })
        });
      });

      children.push(
        new Table({
          rows: docxRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      );
      children.push(new Paragraph({ spacing: { after: 180 } }));
      tableRows = [];
    }
    inTable = false;
  }

  function flushCodeBlock() {
    if (codeLines.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: codeLines.join('\n'),
              font: 'Courier New',
              size: 17,
              color: '0F172A'
            })
          ],
          shading: { fill: 'F8FAFC' },
          border: {
            left: { style: BorderStyle.SINGLE, size: 24, color: '2563EB' }
          },
          spacing: { before: 120, after: 160 }
        })
      );
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
      children.push(new Paragraph({ pageBreakBefore: true }));
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
      // Table line
      if (line.includes('---')) {
        // Separator row
        continue;
      }
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
      inTable = true;
      continue;
    } else {
      if (inTable) {
        flushTable();
      }
    }

    if (!line) {
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      children.push(
        new Paragraph({
          text: line.replace('# ', ''),
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 200 }
        })
      );
    } else if (line.startsWith('## ')) {
      children.push(
        new Paragraph({
          text: line.replace('## ', ''),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 160 }
        })
      );
    } else if (line.startsWith('### ')) {
      children.push(
        new Paragraph({
          text: line.replace('### ', ''),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 220, after: 120 }
        })
      );
    } else if (line.startsWith('#### ')) {
      children.push(
        new Paragraph({
          text: line.replace('#### ', ''),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 100 }
        })
      );
    } else if (line.startsWith('##### ')) {
      children.push(
        new Paragraph({
          text: line.replace('##### ', ''),
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 140, after: 80 }
        })
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      // Bullet list
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.substring(2).replace(/\*\*/g, ''),
              size: 21,
              color: '334155'
            })
          ],
          bullet: { level: 0 },
          spacing: { after: 60 }
        })
      );
    } else {
      // Standard paragraph
      const cleanText = line.replace(/\*\*/g, '').replace(/`/g, '');
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cleanText,
              size: 21,
              color: '1E293B'
            })
          ],
          spacing: { after: 120, line: 276 }
        })
      );
    }
  }

  if (inTable) flushTable();
  if (inCodeBlock) flushCodeBlock();

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
          }
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Attendance Tracker — Design, Development and Implementation',
                    size: 16,
                    color: '64748B'
                  })
                ],
                alignment: AlignmentType.RIGHT
              })
            ]
          })
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Page ', size: 16, color: '64748B' }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '64748B'
                  }),
                  new TextRun({ text: ' of ', size: 16, color: '64748B' }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '64748B'
                  })
                ],
                alignment: AlignmentType.CENTER
              })
            ]
          })
        },
        children
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buffer);
  console.log('SUCCESS: Generated DOCX at ' + outPath + ' (' + buffer.length + ' bytes)');
}

createDocx().catch(err => {
  console.error('Error generating docx:', err);
  process.exit(1);
});
