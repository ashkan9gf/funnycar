// generate_asset_guide_docx.mjs — ساخت Word فارسی RTL: راهنمای مدل سه‌بعدی + صدا
// Cover: Recipe R1 (RTL-mirrored) + palette DM-1 | fonts: Tahoma (cs) + Consolas (code)
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, WidthType, BorderStyle,
  ShadingType, PageNumber, NumberFormat, SectionType, TableOfContents,
  TableLayoutType,
} from "docx";
import fs from "fs";
import { META, CONTENT } from "./guide_content_fa.mjs";

const OUT = "/home/z/my-project/download/FunnyCarIR-3D-Models-and-Sounds-Guide-FA.docx";

// ---------- palette (DM-1 Deep Cyan) ----------
const P = {
  bg: "162235", accent: "37DCF2",
  titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078",
  hBg: "1B6B7A", hText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5",
  h1: "1B6B7A", h2: "177084", body: "000000", code: "0E4A56", gray: "888888",
};
const FA = { ascii: "Tahoma", hAnsi: "Tahoma", cs: "Tahoma", eastAsia: "Tahoma" };
const MONO = { ascii: "Consolas", hAnsi: "Consolas", cs: "Consolas" };

// ---------- border consts (mandatory for cover) ----------
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

// ---------- run helpers ----------
const faRun = (text, o = {}) => new TextRun({
  text, rightToLeft: true, font: FA,
  size: o.size ?? 24, sizeComplexScript: o.size ?? 24,
  bold: o.bold ?? false, boldComplexScript: o.bold ?? false,
  italics: o.italics ?? false, italicsComplexScript: o.italics ?? false,
  color: o.color ?? P.body,
});
const monoRun = (text, o = {}) => new TextRun({
  text, rightToLeft: false, font: MONO,
  size: o.size ?? 20, sizeComplexScript: o.size ?? 20,
  color: o.color ?? P.code,
});
const mapRuns = (parts, o = {}) => parts.map((x) => {
  if (typeof x === "string") return faRun(x, o);
  if (x.m !== undefined) return monoRun(x.m);
  if (x.e !== undefined) return new TextRun({ text: x.e, rightToLeft: false, font: FA, size: o.size ?? 24, color: o.color ?? P.body });
  if (x.b !== undefined) return faRun(x.b, { ...o, bold: true });
  return faRun(String(x), o);
});

// ---------- paragraph helpers ----------
const bodyPara = (parts, o = {}) => new Paragraph({
  bidirectional: true,
  alignment: o.align ?? AlignmentType.JUSTIFIED,
  spacing: { line: 312, before: o.before ?? 0, after: o.after ?? 140 },
  children: mapRuns(parts, o),
});
const stepPara = (label, parts) => new Paragraph({
  bidirectional: true,
  spacing: { line: 312, after: 110 },
  indent: { left: 340, right: 0 },
  children: [faRun(label, { bold: true, color: P.h2 }), ...mapRuns(parts)],
});
const notePara = (parts) => new Paragraph({
  bidirectional: true,
  spacing: { line: 312, before: 160, after: 180 },
  indent: { left: 200, right: 200 },
  shading: { type: ShadingType.CLEAR, fill: P.surface },
  border: { left: { style: BorderStyle.SINGLE, size: 12, color: P.accentLine, space: 8 } },
  children: [faRun("نکته: ", { bold: true, color: P.h2 }), ...mapRuns(parts)],
});
const codePara = (cmd) => new Paragraph({
  alignment: AlignmentType.LEFT,
  spacing: { line: 312, before: 120, after: 170 },
  indent: { left: 200, right: 200 },
  shading: { type: ShadingType.CLEAR, fill: "F2F6F6" },
  border: {
    top: { style: BorderStyle.SINGLE, size: 4, color: "D6E2E2" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "D6E2E2" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "D6E2E2" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "D6E2E2" },
  },
  children: [monoRun(cmd, { size: 21 })],
});
const h1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1, bidirectional: true, keepNext: true,
  spacing: { before: 420, after: 180, line: 400, lineRule: "atLeast" },
  children: [faRun(text, { size: 32, bold: true, color: P.h1 })],
});
const h2 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_2, bidirectional: true, keepNext: true,
  spacing: { before: 300, after: 140, line: 340, lineRule: "atLeast" },
  children: [faRun(text, { size: 28, bold: true, color: P.h2 })],
});

// ---------- table builder (RTL) ----------
let tableNo = 0;
function makeTable(spec) {
  tableNo += 1;
  const { headers, rows, widths } = spec;
  const titlePara = new Paragraph({
    bidirectional: true, keepNext: true,
    spacing: { before: 200, after: 90, line: 312 },
    children: [faRun(`جدول ${tableNo} — ${spec.title}`, { bold: true, size: 22, color: P.h2 })],
  });
  const isLatinOnly = (cell) => Array.isArray(cell) && cell.length > 0 && cell.every((x) => x && typeof x === "object" && x.m !== undefined);
  const cellPara = (cell, bold, color) => {
    const parts = Array.isArray(cell) ? cell : [cell];
    const runs = Array.isArray(cell)
      ? parts.map((x) => (typeof x === "string" ? faRun(x, { size: 21, bold, color }) : monoRun(x.m, { size: 20, color: color ?? P.code })))
      : [faRun(String(cell), { size: 21, bold, color })];
    return new Paragraph({
      bidirectional: !isLatinOnly(cell) && !Array.isArray(cell),
      alignment: isLatinOnly(cell) ? AlignmentType.LEFT : undefined,
      spacing: { line: 312 },
      children: runs,
    });
  };
  const margins = { top: 80, bottom: 80, left: 120, right: 120 };
  const headerRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: headers.map((htext, i) => new TableCell({
      children: [cellPara(htext, true, P.hText)],
      shading: { type: ShadingType.CLEAR, fill: P.hBg },
      margins, width: { size: widths[i], type: WidthType.PERCENTAGE },
    })),
  });
  const dataRows = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((cell, ci) => new TableCell({
      children: [cellPara(cell, false)],
      shading: ri % 2 === 1 ? { type: ShadingType.CLEAR, fill: P.surface } : undefined,
      margins, width: { size: widths[ci], type: WidthType.PERCENTAGE },
    })),
  }));
  const tbl = new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: P.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: P.innerLine },
      insideVertical: NB,
    },
    rows: [headerRow, ...dataRows],
  });
  const spacer = new Paragraph({ spacing: { after: 80, line: 312 }, children: [] });
  return [titlePara, tbl, spacer];
}

// ---------- cover: Recipe R1 mirrored for RTL (calcTitleLayout + calcCoverSpacing) ----------
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."،؛؟!:—–-·/ \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charWidth = (pt) => pt * 12; // Persian avg glyph width
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}
function buildCoverR1RTL(cfg) {
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(cfg.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!cfg.subtitle, hasEnglishLabel: !!cfg.englishLabel,
    metaLineCount: (cfg.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (cfg.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({
        text: cfg.englishLabel.split("").join(" "),
        size: 18, color: P.accent, font: { ascii: "Consolas", hAnsi: "Consolas" }, characterSpacing: 40,
      })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      bidirectional: true,
      indent: { left: padL, right: padR },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [faRun(titleLines[i], { size: titleSize, bold: true, color: P.titleColor })],
    }));
  }
  if (cfg.subtitle) {
    children.push(new Paragraph({
      bidirectional: true, indent: { left: padL, right: padR }, spacing: { after: 800, line: 340, lineRule: "atLeast" },
      children: [faRun(cfg.subtitle, { size: 24, color: P.subtitleColor })],
    }));
  }
  for (const line of (cfg.metaLines || [])) {
    children.push(new Paragraph({
      bidirectional: true, indent: { left: padL + 200, right: padR }, spacing: { after: 80, line: 312 },
      border: { left: accentLeft },
      children: [faRun(line, { size: 24, color: P.metaColor })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    bidirectional: true, indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200, line: 280 },
    children: [
      faRun(cfg.footerLeft || "", { size: 16, color: P.footerColor }),
      new TextRun({ text: "                                        ", size: 16 }),
      faRun(cfg.footerRight || "", { size: 16, color: P.footerColor }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: "top",
        children,
      })],
    })],
  })];
}

// ---------- body assembly ----------
function buildBody() {
  const out = [];
  for (const block of CONTENT) {
    if (block.h1) out.push(h1(block.h1));
    else if (block.h2) out.push(h2(block.h2));
    else if (block.p) out.push(bodyPara(block.p));
    else if (block.steps) for (const s of block.steps) out.push(stepPara(s.label, s.runs));
    else if (block.note) out.push(notePara(block.note));
    else if (block.code) out.push(codePara(block.code));
    else if (block.table) out.push(...makeTable(block.table));
  }
  return out;
}

// ---------- headers / footers ----------
const pageHeader = new Header({
  children: [new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER, spacing: { line: 240, after: 60 },
    children: [faRun(META.header, { size: 18, color: P.gray })],
  })],
});
const romanFooter = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { line: 240 },
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, italics: true, color: "666666", font: FA })],
  })],
});
const arabicFooter = new Footer({
  children: [new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { line: 240 },
    children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "444444", font: FA })],
  })],
});

// ---------- TOC section children ----------
const tocChildren = [
  new Paragraph({
    bidirectional: true, alignment: AlignmentType.CENTER,
    spacing: { before: 480, after: 360, line: 400, lineRule: "atLeast" },
    children: [faRun("فهرست مطالب", { size: 32, bold: true, color: "1A1A1A" })],
  }),
  new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
  new Paragraph({
    bidirectional: true, spacing: { before: 220, line: 280 },
    children: [faRun("یادآوری: این فهرست با فیلد خودکار Word ساخته می‌شود؛ پس از باز کردن فایل، روی فهرست راست‌کلیک کنید و گزینه Update Field را بزنید تا شماره صفحه‌ها دقیق شود.", { size: 18, italics: true, color: P.gray })],
  }),
];

// ---------- document ----------
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1417, right: 1701 }; // RTL: binding edge = right

const doc = new Document({
  title: META.title,
  creator: "FunnyCarIR",
  styles: {
    default: {
      document: {
        run: { font: FA, size: 24, color: P.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FA, size: 32, bold: true, color: P.h1 },
        paragraph: { spacing: { before: 420, after: 180, line: 400 } },
      },
      heading2: {
        run: { font: FA, size: 28, bold: true, color: P.h2 },
        paragraph: { spacing: { before: 300, after: 140, line: 340 } },
      },
      heading3: {
        run: { font: FA, size: 24, bold: true, color: P.h2 },
        paragraph: { spacing: { before: 240, after: 120, line: 312 } },
      },
    },
  },
  sections: [
    { // Section 1 — cover (margin 0, no header/footer, no pageNumbers)
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1RTL({
        title: META.title, subtitle: META.subtitle, englishLabel: META.label,
        metaLines: META.metaLines, footerLeft: META.footerLeft, footerRight: META.footerRight,
      }),
    },
    { // Section 2 — TOC (Roman)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: pageHeader },
      footers: { default: romanFooter },
      children: tocChildren,
    },
    { // Section 3 — body (Arabic, restart at 1)
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: pageHeader },
      footers: { default: arabicFooter },
      children: buildBody(),
    },
  ],
});

const buf = await Packer.toBuffer(doc);
fs.writeFileSync(OUT, buf);
console.log("OK →", OUT, `(${Math.round(buf.length / 1024)} KB)`);
