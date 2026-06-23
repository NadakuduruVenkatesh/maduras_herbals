// =====================================================================
// allergen.js — Allergen Declaration PDF Generator (Maduras Herbals)
// =====================================================================

import { PDFDocument, rgb, StandardFonts } from './pdf-lib.esm.js';

const COL = {
  tableHeader: rgb(0.369, 0.647, 0),
  rowAlt:      rgb(0.93, 0.97, 0.93),
  rowWhite:    rgb(1, 1, 1),
  border:      rgb(0.7, 0.7, 0.7),
  red:         rgb(1, 0, 0),
  black:       rgb(0, 0, 0),
  white:       rgb(1, 1, 1),
};

const PW = 595.28, PH = 841.89;
const ML = 50,     MR = 50;
const CW = PW - ML - MR;

// Column widths
const W1 = CW * 0.46;   // MATERIAL
const W2 = CW * 0.28;   // CAS NUMBER
const W3 = CW * 0.26;   // INCLUSION %

const FOOT_Y = 100;
const FS = 8.5, LH = 11, RPAD = 4;

function getNextDocNumber() {
  const key  = 'maduras_docNum_allergen';
  const next = (parseInt(localStorage.getItem(key) || '0', 10)) + 1;
  localStorage.setItem(key, String(next));
  return 'ALLERGEN-' + String(next).padStart(5, '0');
}

function todayFormatted() {
  const d  = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + '/' + d.getFullYear();
}

// ── Public entry point ────────────────────────────────────────────────
export async function generatePDF(d, _fileName) {
  const doc         = await PDFDocument.create();
  const bold        = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular     = await doc.embedFont(StandardFonts.Helvetica);
  const boldOblique = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  let logoImg = null;
  try {
    const logoUrl   = new URL('./logo.png', import.meta.url).href;
    const logoBytes = await fetch(logoUrl).then(r => r.arrayBuffer());
    logoImg = await doc.embedPng(logoBytes);
  } catch (e) {
    console.warn('[Allergen] Logo load failed:', e.message);
  }

  const docNo   = d._docNo   || getNextDocNumber();
  const docDate = d._docDate || todayFormatted();

  const ctx = { doc, page: doc.addPage([PW, PH]), bold, regular, boldOblique, logoImg, docNo, docDate };

  drawWatermark(ctx.page, logoImg);
  drawHeader(ctx.page, bold, regular, boldOblique, logoImg);

  let y = PH - 120;

  // ── Title ────────────────────────────────────────────────────────────
  const title = d._title || 'DECLARATION OF ALLERGENS';
  const tw    = bold.widthOfTextAtSize(title, 14);
  ctx.page.drawText(title, { x: PW / 2 - tw / 2, y, size: 14, font: bold, color: COL.black });
  ctx.page.drawLine({
    start: { x: PW / 2 - tw / 2, y: y - 2 },
    end:   { x: PW / 2 + tw / 2, y: y - 2 },
    thickness: 1.5, color: COL.black,
  });
  y -= 28;

  // ── Product Info ─────────────────────────────────────────────────────
  ctx.page.drawText('Product Name   :', { x: ML, y, size: 10, font: bold,        color: COL.black });
  ctx.page.drawText(String(d.product_name   || 'N/A'), { x: ML + 130, y, size: 10, font: regular,     color: COL.black });
  y -= 18;
  ctx.page.drawText('Botanical Name :', { x: ML, y, size: 10, font: bold,        color: COL.black });
  ctx.page.drawText(String(d.botanical_name || 'N/A'), { x: ML + 130, y, size: 10, font: boldOblique, color: COL.black });
  y -= 22;

  // ── Allergen Table ───────────────────────────────────────────────────
  const cols = [
    { label: 'MATERIAL',                           x: ML,           w: W1 },
    { label: 'CAS NUMBER',                         x: ML + W1,      w: W2 },
    { label: 'COSMETIC ALLERGENS\nINCLUSION (%)',  x: ML + W1 + W2, w: W3 },
  ];

  y = drawTableHeader(ctx.page, bold, y, cols);

  let altIdx = 0;
  for (const row of (d.allergens || [])) {
    const values = [row.material || '', row.cas_number || '', row.inclusion || '-'];
    const rh     = calcRowH(regular, values, cols);

    if (y - rh < FOOT_Y) {
      newAllergenPage(ctx);
      y = PH - 65;
      y = drawTableHeader(ctx.page, bold, y, cols);
      altIdx = 0;
    }

    y = drawAllergenRow(ctx.page, regular, y, cols, values, altIdx % 2 === 0);
    altIdx++;
  }

  // ── Disclaimer ───────────────────────────────────────────────────────
  if (d.disclaimer) {
    y -= 14;
    y = drawDisclaimer(ctx, d.disclaimer, y);
  }

  // ── Footer area ──────────────────────────────────────────────────────
  await drawFooterArea(ctx.page, bold, regular, y - 16, doc, d);
  drawBottomBar(ctx.page, regular, docNo, docDate);

  return await doc.save();
}

// ── New continuation page ─────────────────────────────────────────────
function newAllergenPage(ctx) {
  const page = ctx.doc.addPage([PW, PH]);
  drawWatermark(page, ctx.logoImg);
  drawMiniHeader(page, ctx.regular, ctx.logoImg, ctx.docNo, ctx.docDate);
  ctx.page = page;
}

// ── Watermark ─────────────────────────────────────────────────────────
function drawWatermark(page, logoImg) {
  if (!logoImg) return;
  const wW = 380, wH = (logoImg.height / logoImg.width) * wW;
  page.drawImage(logoImg, { x: PW/2 - wW/2, y: PH/2 - wH/2 - 30, width: wW, height: wH, opacity: 0.05 });
}

// ── Full header (page 1) ──────────────────────────────────────────────
function drawHeader(page, bold, regular, boldOblique, logoImg) {
  page.drawText('MADURAS HERBALS', { x: ML, y: PH - 36, size: 18, font: bold, color: COL.black });
  page.drawText('Connecting Nature to You', { x: ML, y: PH - 49, size: 8, font: boldOblique, color: COL.tableHeader });

  if (logoImg) {
    const lw = 155, lh = (logoImg.height / logoImg.width) * lw;
    page.drawImage(logoImg, { x: PW/2 - lw/2 + 18, y: PH + 10 - lh, width: lw, height: lh });
  }

  ['Phone: +91 73390 22047', '+91 75025 49477', 'Email: hello@madurasherbals.com', 'Website: www.madurasherbals.com']
    .forEach((line, i) => {
      const tw = regular.widthOfTextAtSize(line, 8);
      page.drawText(line, { x: PW - MR - tw, y: PH - 18 - i * 13, size: 8, font: regular, color: COL.black });
    });

  page.drawRectangle({ x: ML, y: PH - 74, width: CW, height: 5, color: COL.red });
}

// ── Mini header (continuation pages) ─────────────────────────────────
function drawMiniHeader(page, regular, logoImg, docNo, docDate) {
  if (logoImg) {
    const lw = 75, lh = (logoImg.height / logoImg.width) * lw;
    page.drawImage(logoImg, { x: ML, y: PH - 8 - lh, width: lw, height: lh });
  }
  const dnText = 'Doc No: ' + docNo;
  const dtText = 'Date: '   + docDate;
  page.drawText(dnText, { x: PW - MR - regular.widthOfTextAtSize(dnText, 8), y: PH - 18, size: 8, font: regular, color: COL.black });
  page.drawText(dtText, { x: PW - MR - regular.widthOfTextAtSize(dtText, 8), y: PH - 30, size: 8, font: regular, color: COL.black });
  page.drawRectangle({ x: ML, y: PH - 50, width: CW, height: 4, color: COL.red });
}

// ── Table header (handles 2-line labels) ──────────────────────────────
function drawTableHeader(page, bold, y, cols) {
  const RH = 30;
  page.drawRectangle({ x: ML, y: y - RH, width: CW, height: RH, color: COL.tableHeader });
  cols.forEach(({ label, x, w }, i) => {
    if (i > 0) page.drawLine({ start: { x, y }, end: { x, y: y - RH }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
    const lines  = label.split('\n');
    const blockH = lines.length * 11;
    const y0     = y - (RH - blockH) / 2 - 8;
    lines.forEach((line, j) => {
      const lw = bold.widthOfTextAtSize(line, 8.5);
      page.drawText(line, { x: x + (w - lw) / 2, y: y0 - j * 11, size: 8.5, font: bold, color: COL.white });
    });
  });
  return y - RH;
}

// ── Calculate row height ──────────────────────────────────────────────
function calcRowH(regular, values, cols) {
  const maxLines = Math.max(...values.map((v, i) => wrapText(regular, String(v ?? '-'), FS, cols[i].w - 10).length));
  return maxLines * LH + 2 * RPAD;
}

// ── Draw one allergen row ─────────────────────────────────────────────
function drawAllergenRow(page, regular, y, cols, values, alt) {
  const wrapped  = values.map((v, i) => wrapText(regular, String(v ?? '-'), FS, cols[i].w - 10));
  const maxLines = Math.max(...wrapped.map(l => l.length));
  const rh       = maxLines * LH + 2 * RPAD;

  page.drawRectangle({ x: ML, y: y - rh, width: CW, height: rh, color: alt ? COL.rowWhite : COL.rowAlt, borderColor: COL.border, borderWidth: 0.3 });

  cols.forEach(({ x, w }, i) => {
    if (i > 0) page.drawLine({ start: { x, y }, end: { x, y: y - rh }, thickness: 0.5, color: COL.border });
    const lines   = wrapped[i];
    const blockH  = lines.length * LH;
    const y0      = y - (rh - blockH) / 2 - FS * 0.85;
    lines.forEach((line, j) => {
      const lw = regular.widthOfTextAtSize(line, FS);
      // Material: left-aligned; CAS + Inclusion: centered
      const tx = i === 0 ? x + 5 : x + (w - lw) / 2;
      page.drawText(line, { x: tx, y: y0 - j * LH, size: FS, font: regular, color: COL.black });
    });
  });

  return y - rh;
}

// ── Disclaimer ────────────────────────────────────────────────────────
function drawDisclaimer(ctx, text, y) {
  const label   = 'DISCLAIMER: ';
  const body    = text.replace(/^DISCLAIMER[:\s]*/i, '');
  const lw      = ctx.bold.widthOfTextAtSize(label, FS);
  const allText = label + body;
  const lines   = wrapText(ctx.regular, allText, FS, CW - 4);

  for (const line of lines) {
    if (y - LH < FOOT_Y) {
      newAllergenPage(ctx);
      y = PH - 65;
    }
    if (line.startsWith(label.trim())) {
      ctx.page.drawText(label,                   { x: ML,      y, size: FS, font: ctx.bold,    color: COL.black });
      ctx.page.drawText(line.slice(label.length), { x: ML + lw, y, size: FS, font: ctx.regular, color: COL.black });
    } else {
      ctx.page.drawText(line, { x: ML, y, size: FS, font: ctx.regular, color: COL.black });
    }
    y -= LH;
  }
  return y;
}

// ── Footer area — signature only ──────────────────────────────────────
async function drawFooterArea(page, bold, regular, y, doc, d) {
  const sigY = y - 10;
  if (d._sigOption === 1) {
    const text = 'This is a computer-generated document and does not require a signature.';
    page.drawText(text, { x: ML, y: sigY, size: 8.5, font: regular, color: COL.black });
  } else if (d._sigOption === 2 && d._sigBytes) {
    try {
      let sigImg;
      try { sigImg = await doc.embedPng(d._sigBytes); } catch { sigImg = await doc.embedJpg(d._sigBytes); }
      const sigW = 130, sigH = (sigImg.height / sigImg.width) * sigW;
      page.drawImage(sigImg, { x: ML + 20, y: sigY - sigH + 10, width: sigW, height: sigH });
    } catch (e) { console.warn('[Allergen] Signature embed failed:', e); }
  }
}

// ── Bottom bar ────────────────────────────────────────────────────────
function drawBottomBar(page, regular, docNo, docDate) {
  page.drawRectangle({ x: ML, y: 42, width: CW, height: 5, color: COL.tableHeader });
  page.drawText('Doc No: ' + docNo,  { x: ML, y: 30, size: 7.5, font: regular, color: COL.black });
  page.drawText('Date: '   + docDate, { x: ML, y: 20, size: 7.5, font: regular, color: COL.black });
}

// ── Text wrap helper ──────────────────────────────────────────────────
function wrapText(font, text, size, maxWidth) {
  const str = String(text ?? '-');
  const result = [];
  function breakWord(word) {
    let chunk = '';
    for (const ch of word) {
      const test = chunk + ch;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) { chunk = test; }
      else { if (chunk) result.push(chunk); chunk = ch; }
    }
    if (chunk) result.push(chunk);
  }
  for (const para of str.split('\n')) {
    const words = para.trim().split(/\s+/);
    let line = '';
    for (const word of words) {
      if (font.widthOfTextAtSize(word, size) > maxWidth) {
        if (line) { result.push(line); line = ''; }
        breakWord(word);
        continue;
      }
      const test = line ? line + ' ' + word : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) { line = test; }
      else { if (line) result.push(line); line = word; }
    }
    if (line) result.push(line);
  }
  return result.length ? result : ['-'];
}
