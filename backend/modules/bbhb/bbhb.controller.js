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
    const { baslik, aciklama, hayvanlar } = req.body;
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
      baslik, aciklama: aciklama || '', hayvanlar: islenmiş,
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
    ws.getCell('A4').value = 'Açıklama:';     ws.getCell('B4').value = kayit.aciklama;
    ws.getCell('A5').value = 'Tarih:';        ws.getCell('B5').value = new Date(kayit.createdAt).toLocaleDateString('tr-TR');

    const headerRow = ws.getRow(7);
    ['Hayvan Türü', 'Katsayı', 'Adet', 'BBHB', 'Grup'].forEach((h, i) => {
      headerRow.getCell(i + 1).value = h;
      headerRow.getCell(i + 1).font = { bold: true };
      headerRow.getCell(i + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D9E75' } };
      headerRow.getCell(i + 1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    const aktif = kayit.hayvanlar.filter(h => h.adet > 0);
    aktif.forEach((h, i) => {
      const row = ws.getRow(8 + i);
      row.values = [h.tur_adi, h.katsayi, h.adet, h.bbhb, ''];
      if (i % 2 === 0) {
        row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5EE' } }; });
      }
    });

    const sumRow = ws.getRow(8 + aktif.length + 1);
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

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bbhb_${kayit._id}.pdf`);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text('BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU', { align: 'center' });
    doc.moveDown();
    doc.fontSize(11).font('Helvetica').text(`Başlık: ${kayit.baslik}`);
    doc.text(`Tarih: ${new Date(kayit.createdAt).toLocaleDateString('tr-TR')}`);
    if (kayit.aciklama) doc.text(`Açıklama: ${kayit.aciklama}`);
    doc.moveDown();

    const colX = [50, 260, 340, 410, 480];
    const headers = ['Hayvan Türü', 'Katsayı', 'Adet', 'BBHB'];
    doc.font('Helvetica-Bold').fontSize(10);
    headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: colX[i + 1] - colX[i] - 5 }));
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    const aktif = kayit.hayvanlar.filter(h => h.adet > 0);
    doc.font('Helvetica').fontSize(10);
    aktif.forEach(h => {
      const y = doc.y;
      doc.text(h.tur_adi,  colX[0], y, { width: 200 });
      doc.text(String(h.katsayi), colX[1], y, { width: 70 });
      doc.text(String(h.adet),    colX[2], y, { width: 60 });
      doc.text(String(h.bbhb),    colX[3], y, { width: 70 });
      doc.moveDown(0.4);
    });

    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(11);
    doc.text(`Toplam Hayvan: ${kayit.toplam_adet}`, 50);
    doc.text(`Toplam BBHB: ${kayit.toplam_bbhb}`, 50);

    doc.end();
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

module.exports = { getTurler, hesapla, kaydet, listele, getById, sil, excelRapor, pdfRapor, wordRapor };
