const BBHBHesaplama = require('./bbhb.model');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } = require('docx');

const HAYVAN_TURLERI = [
  { tur_id: 'kult_sut',   tur_adi: 'Kültür ırkı süt ineği',       katsayi: 1.00, grup: 'Sığır' },
  { tur_id: 'kult_mez',   tur_adi: 'Kültür melezi',                katsayi: 0.75, grup: 'Sığır' },
  { tur_id: 'yerli_inek', tur_adi: 'Yerli inek',                   katsayi: 0.50, grup: 'Sığır' },
  { tur_id: 'dana_kult',  tur_adi: 'Dana-düve (kültür ırkı)',      katsayi: 0.60, grup: 'Sığır' },
  { tur_id: 'dana_mez',   tur_adi: 'Dana-düve (kültür melezi)',    katsayi: 0.45, grup: 'Sığır' },
  { tur_id: 'dana_yerli', tur_adi: 'Dana-düve (yerli)',            katsayi: 0.30, grup: 'Sığır' },
  { tur_id: 'boga',       tur_adi: 'Boğa',                        katsayi: 1.50, grup: 'Sığır' },
  { tur_id: 'okuz',       tur_adi: 'Öküz',                        katsayi: 0.60, grup: 'Sığır' },
  { tur_id: 'manda_e',    tur_adi: 'Manda (erkek)',               katsayi: 0.90, grup: 'Manda' },
  { tur_id: 'manda_d',    tur_adi: 'Manda (dişi)',                katsayi: 0.75, grup: 'Manda' },
  { tur_id: 'koyun',      tur_adi: 'Koyun',                       katsayi: 0.10, grup: 'Küçükbaş' },
  { tur_id: 'keci',       tur_adi: 'Keçi',                        katsayi: 0.08, grup: 'Küçükbaş' },
  { tur_id: 'kuzu',       tur_adi: 'Kuzu-oğlak',                  katsayi: 0.04, grup: 'Küçükbaş' },
  { tur_id: 'at',         tur_adi: 'At',                          katsayi: 0.50, grup: 'Yük Hayvanı' },
  { tur_id: 'katir',      tur_adi: 'Katır',                       katsayi: 0.40, grup: 'Yük Hayvanı' },
  { tur_id: 'esek',       tur_adi: 'Eşek',                        katsayi: 0.30, grup: 'Yük Hayvanı' },
];

const getTurler = (req, res) => {
  res.json({ success: true, data: HAYVAN_TURLERI });
};

const hesapla = (req, res) => {
  const { hayvanlar } = req.body;
  if (!Array.isArray(hayvanlar)) {
    return res.status(400).json({ success: false, message: 'hayvanlar dizisi gerekli' });
  }
  const sonuc = hayvanlar.map(h => {
    const tur = HAYVAN_TURLERI.find(t => t.tur_id === h.tur_id);
    if (!tur) return null;
    const adet = Math.max(0, parseInt(h.adet) || 0);
    return { ...tur, adet, bbhb: parseFloat((adet * tur.katsayi).toFixed(4)) };
  }).filter(Boolean);

  const toplam_adet = sonuc.reduce((s, h) => s + h.adet, 0);
  const toplam_bbhb = parseFloat(sonuc.reduce((s, h) => s + h.bbhb, 0).toFixed(4));
  const tur_sayisi = sonuc.filter(h => h.adet > 0).length;

  res.json({ success: true, data: { hayvanlar: sonuc, toplam_adet, toplam_bbhb, tur_sayisi } });
};

const kaydet = async (req, res, next) => {
  try {
    const { baslik, ciftci_ad, aciklama, hayvanlar } = req.body;
    const islenmiş = hayvanlar.map(h => {
      const tur = HAYVAN_TURLERI.find(t => t.tur_id === h.tur_id);
      if (!tur) throw Object.assign(new Error(`Geçersiz tür: ${h.tur_id}`), { statusCode: 400 });
      const adet = Math.max(0, parseInt(h.adet) || 0);
      return { tur_id: tur.tur_id, tur_adi: tur.tur_adi, katsayi: tur.katsayi, adet, bbhb: parseFloat((adet * tur.katsayi).toFixed(4)) };
    });
    const toplam_adet = islenmiş.reduce((s, h) => s + h.adet, 0);
    const toplam_bbhb = parseFloat(islenmiş.reduce((s, h) => s + h.bbhb, 0).toFixed(4));
    const tur_sayisi = islenmiş.filter(h => h.adet > 0).length;

    const kayit = await BBHBHesaplama.create({
      baslik, ciftci_ad: ciftci_ad || '', aciklama: aciklama || '', hayvanlar: islenmiş,
      toplam_adet, toplam_bbhb, tur_sayisi, durum: 'tamamlandi',
    });
    res.status(201).json({ success: true, data: kayit });
  } catch (err) { next(err); }
};

const listele = async (req, res, next) => {
  try {
    const kayitlar = await BBHBHesaplama.find().sort({ createdAt: -1 }).select('-hayvanlar');
    res.json({ success: true, count: kayitlar.length, data: kayitlar });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, data: kayit });
  } catch (err) { next(err); }
};

const sil = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findByIdAndDelete(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, message: 'Kayıt silindi' });
  } catch (err) { next(err); }
};

const excelRapor = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MİS - Mera İzleme Sistemi';
    const ws = wb.addWorksheet('BBHB Hesaplama');

    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = 'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) HESAPLAMA RAPORU';
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.getCell('A1').alignment = { horizontal: 'center' };

    ws.getCell('A3').value = 'Başlık:';       ws.getCell('B3').value = kayit.baslik;
    ws.getCell('A4').value = 'Çiftçi:';       ws.getCell('B4').value = kayit.ciftci_ad || '-';
    ws.getCell('A5').value = 'Açıklama:';     ws.getCell('B5').value = kayit.aciklama;
    ws.getCell('A6').value = 'Tarih:';        ws.getCell('B6').value = new Date(kayit.createdAt).toLocaleDateString('tr-TR');

    const headerRow = ws.getRow(8);
    ['Hayvan Türü', 'Katsayı', 'Adet', 'BBHB', 'Grup'].forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
      headerRow.getCell(i + 1).font = { bold: true };
      headerRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
      headerRow.getCell(i + 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    const aktif = kayit.hayvanlar.filter(h => h.adet > 0);
    aktif.forEach((h, i) => {
      const row = ws.getRow(10 + i);
      row.values = [h.tur_adi, h.katsayi, h.adet, h.bbhb, ''];
      if (i % 2 === 0) {
        row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5EE' } }; });
      }
    });

    const sumRow = ws.getRow(10 + aktif.length + 1);
    sumRow.getCell(1).value = 'TOPLAM';
    sumRow.getCell(3).value = kayit.toplam_adet;
    sumRow.getCell(4).value = kayit.toplam_bbhb;
    sumRow.eachCell(c => { c.font = { bold: true }; });

    ws.columns = [{ width: 32 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 14 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=bbhb_${kayit._id}.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) { next(err); }
};

const pdfRapor = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });

    const aktif = kayit.hayvanlar.filter(h => h.adet > 0);
    const tarih = new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    const satirlar = aktif.map(h => `
      <tr>
        <td>${h.tur_adi}</td>
        <td class="center">${h.katsayi}</td>
        <td class="center">${h.adet}</td>
        <td class="right">${h.bbhb.toFixed(2)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>BBHB Raporu - ${kayit.baslik}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Noto Sans', Arial, sans-serif; font-size:11pt; color:#222; padding:20mm; }
    h1 { font-size:15pt; text-align:center; margin-bottom:8mm; color:#0F6E56; }
    .meta { margin-bottom:6mm; font-size:10pt; }
    .meta span { display:inline-block; margin-right:15mm; }
    table { width:100%; border-collapse:collapse; margin-bottom:6mm; }
    th { background:#0F6E56; color:#fff; padding:5pt 8pt; font-size:10pt; }
    td { padding:4pt 8pt; border-bottom:1px solid #ddd; font-size:10pt; }
    tr:nth-child(even) td { background:#f5faf7; }
    .center { text-align:center; }
    .right { text-align:right; }
    .toplam { font-weight:bold; border-top:2px solid #0F6E56; }
    .toplam td { padding-top:6pt; }
    .ozet { margin-top:6mm; padding:5mm; background:#e1f5ee; border-radius:4px; }
    .ozet table { margin:0; }
    .ozet td { border:none; background:none; font-size:10pt; }
    .footer { margin-top:10mm; font-size:9pt; color:#888; text-align:center; border-top:1px solid #ddd; padding-top:4mm; }
    @media print { .no-print { display:none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:8mm;">
    <button onclick="window.print()" style="background:#0F6E56;color:#fff;border:none;padding:8px 24px;border-radius:6px;font-size:12pt;cursor:pointer;">
      PDF Olarak Yazdır / Kaydet
    </button>
  </div>
  <h1>BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU</h1>
  <div class="meta">
    <span><strong>Başlık:</strong> ${kayit.baslik}</span>
    ${kayit.ciftci_ad ? `<span><strong>Çiftçi:</strong> ${kayit.ciftci_ad}</span>` : ''}
    <span><strong>Tarih:</strong> ${tarih}</span>
    ${kayit.aciklama ? `<span><strong>Açıklama:</strong> ${kayit.aciklama}</span>` : ''}
  </div>
  <table>
    <thead>
      <tr><th>Hayvan Türü</th><th class="center">Katsayı</th><th class="center">Adet</th><th class="right">BBHB</th></tr>
    </thead>
    <tbody>
      ${satirlar}
      <tr class="toplam">
        <td colspan="2"><strong>TOPLAM</strong></td>
        <td class="center"><strong>${kayit.toplam_adet}</strong></td>
        <td class="right"><strong>${kayit.toplam_bbhb.toFixed(2)}</strong></td>
      </tr>
    </tbody>
  </table>
  <div class="ozet">
    <table>
      <tr>
        <td><strong>Toplam Hayvan:</strong> ${kayit.toplam_adet}</td>
        <td><strong>Toplam BBHB:</strong> ${kayit.toplam_bbhb.toFixed(2)}</td>
        <td><strong>Aktif Tür:</strong> ${aktif.length}</td>
        <td><strong>Canlı Ağırlık:</strong> ${(kayit.toplam_bbhb * 500).toFixed(0)} kg</td>
      </tr>
      <tr>
        <td><strong>Yeşil Kaba Yem (180 gün):</strong> ${(kayit.toplam_bbhb * 50 * 180).toLocaleString('tr-TR')} kg</td>
        <td colspan="3"><strong>Kuru Kaba Yem (180 gün):</strong> ${(kayit.toplam_bbhb * 12.5 * 180).toLocaleString('tr-TR')} kg</td>
      </tr>
    </table>
  </div>
  <div class="footer">MİS - Mera İzleme Sistemi &nbsp;|&nbsp; ${new Date().toLocaleString('tr-TR')}</div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
};

const wordRapor = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });

    const aktif = kayit.hayvanlar.filter(h => h.adet > 0);

    const tableRows = [
      new TableRow({
        children: ['Hayvan Türü', 'Katsayı', 'Adet', 'BBHB'].map(t =>
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true })] })] })
        ),
      }),
      ...aktif.map(h => new TableRow({
        children: [h.tur_adi, String(h.katsayi), String(h.adet), String(h.bbhb)].map(t =>
          new TableCell({ children: [new Paragraph(t)] })
        ),
      })),
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: 'TOPLAM', bold: true })] })] }),
          new TableCell({ children: [new Paragraph('')] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(kayit.toplam_adet), bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(kayit.toplam_bbhb), bold: true })] })] }),
        ],
      }),
    ];

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ text: 'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU', heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
          new Paragraph(`Başlık: ${kayit.baslik}`),
          new Paragraph(`Tarih: ${new Date(kayit.createdAt).toLocaleDateString('tr-TR')}`),
          new Paragraph(kayit.aciklama ? `Açıklama: ${kayit.aciklama}` : ''),
          new Paragraph(''),
          new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }),
        ],
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=bbhb_${kayit._id}.docx`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = { getTurler, hesapla, kaydet, listele, getById, sil, excelRapor, pdfRapor, wordRapor, HAYVAN_TURLERI };
