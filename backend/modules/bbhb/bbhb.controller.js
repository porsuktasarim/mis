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
    const ws = wb.addWorksheet('BBHB');

    const GREEN = 'FF0F6E56';
    const LIGHTGREEN = 'FFE1F5EE';
    const WHITE = 'FFFFFFFF';
    const GREY = 'FFF5FAF7';

    // Sütun genişlikleri — ekteki tablo gibi
    ws.columns = [
      { width: 6 },   // Sıra No
      { width: 28 },  // Adı Soyadı
      { width: 9 },   // Kültür İnek
      { width: 9 },   // Kültür Da-Dü
      { width: 9 },   // Melez İnek
      { width: 9 },   // Melez Da-Dü
      { width: 9 },   // Yerli İnek
      { width: 9 },   // Yerli Da-Dü
      { width: 9 },   // Koyun
      { width: 9 },   // Kuzu
      { width: 9 },   // Keçi
      { width: 9 },   // At
      { width: 9 },   // Eşek
      { width: 12 },  // Toplam BBHB
    ];

    const style = (cell, opts={}) => {
      if (opts.bg) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:opts.bg } };
      if (opts.color) cell.font = { ...(cell.font||{}), color:{ argb:opts.color }, bold:opts.bold||false, size:opts.size };
      else if (opts.bold) cell.font = { ...(cell.font||{}), bold:true, size:opts.size };
      cell.alignment = { horizontal: opts.align||'center', vertical:'middle', wrapText:true };
      if (opts.border) {
        const b = { style:'thin', color:{ argb:'FFCCCCCC' } };
        cell.border = { top:b, bottom:b, left:b, right:b };
      }
    };

    // Satır 1: Ana başlık
    ws.mergeCells('A1:N1');
    ws.getCell('A1').value = kayit.baslik || 'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) HESAPLAMA';
    style(ws.getCell('A1'), { bg:GREEN, color:WHITE, bold:true, size:13, align:'center' });
    ws.getRow(1).height = 28;

    // Satır 2: İşletmeci / Tarih
    ws.mergeCells('A2:B2'); ws.getCell('A2').value = 'İşletmeci:';
    style(ws.getCell('A2'), { bold:true, align:'left' });
    ws.mergeCells('C2:H2'); ws.getCell('C2').value = kayit.ciftci_ad || '-';
    style(ws.getCell('C2'), { align:'left' });
    ws.mergeCells('I2:K2'); ws.getCell('I2').value = 'Tarih:';
    style(ws.getCell('I2'), { bold:true, align:'left' });
    ws.mergeCells('L2:N2'); ws.getCell('L2').value = new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    style(ws.getCell('L2'), { align:'left' });
    ws.getRow(2).height = 18;

    // Satır 3: boş
    ws.getRow(3).height = 4;

    // Satır 4: Üst başlık grubu
    ws.mergeCells('A4:A6'); ws.getCell('A4').value = 'Sıra\nNo';
    style(ws.getCell('A4'), { bg:GREEN, color:WHITE, bold:true });
    ws.mergeCells('B4:B6'); ws.getCell('B4').value = 'İkamet Eden Aile Temsilcisinin\nAdı Soyadı (Aile)';
    style(ws.getCell('B4'), { bg:GREEN, color:WHITE, bold:true });
    ws.mergeCells('C4:N4'); ws.getCell('C4').value = 'Büyükbaş, Küçükbaş ve Diğer Hayvan Varlıkları';
    style(ws.getCell('C4'), { bg:GREEN, color:WHITE, bold:true });
    ws.getRow(4).height = 28;

    // Satır 5: Alt gruplar
    ws.mergeCells('C5:D5'); ws.getCell('C5').value = 'Kültür Irkı';
    ws.mergeCells('E5:F5'); ws.getCell('E5').value = 'Kültür Melezi';
    ws.mergeCells('G5:H5'); ws.getCell('G5').value = 'Yerli Irk';
    ws.mergeCells('I5:K5'); ws.getCell('I5').value = 'Küçükbaş';
    ws.mergeCells('L5:M5'); ws.getCell('L5').value = 'Tek Tırnaklı';
    ws.mergeCells('N5:N5'); ws.getCell('N5').value = '';
    ['C5','E5','G5','I5','L5'].forEach(c => style(ws.getCell(c), { bg:'FF1D9E75', color:WHITE, bold:true }));
    ['D5','F5','H5','J5','K5','M5','N5'].forEach(c => {
      ws.getCell(c).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1D9E75' } };
    });
    ws.getRow(5).height = 18;

    // Satır 6: Sütun başlıkları
    const h6 = ['', '', 'İnek', 'Da-Dü', 'İnek', 'Da-Dü', 'İnek', 'Da-Dü', 'Koyun', 'Kuzu', 'Keçi', 'At', 'Eşek', 'Toplam\nBBHB'];
    h6.forEach((v,i) => {
      const cell = ws.getRow(6).getCell(i+1);
      cell.value = v;
      style(cell, { bg:'FF1D9E75', color:WHITE, bold:true });
    });
    ws.getRow(6).height = 22;

    // Türlerin BBHB katsayıları — Excel tablosuna uygun sütun eşleşmesi
    // Sütun sırasına göre: Kültür İnek, Kültür Da-Dü, Melez İnek, Melez Da-Dü, Yerli İnek, Yerli Da-Dü, Koyun, Kuzu, Keçi, At, Eşek
    const TUR_KOLON = {
      'Kültür Irkı İnek':    3,
      'Kültür Irkı Da-Dü':   4,
      'Kültür Melezi İnek':  5,
      'Kültür Melezi Da-Dü': 6,
      'Yerli Irk İnek':      7,
      'Yerli Irk Da-Dü':     8,
      'Koyun':               9,
      'Kuzu':               10,
      'Keçi':               11,
      'At':                 12,
      'Eşek':               13,
    };

    // Tek satır — işletmecinin hayvanları
    const satir = 7;
    const row = ws.getRow(satir);
    row.height = 22;
    row.getCell(1).value = 1;
    style(row.getCell(1), { border:true });
    row.getCell(2).value = kayit.ciftci_ad || '-';
    style(row.getCell(2), { align:'left', border:true });

    // Hayvanları uygun sütunlara yerleştir
    for (let col = 3; col <= 13; col++) {
      const cell = row.getCell(col);
      cell.value = null;
      style(cell, { border:true });
    }
    const aktif = kayit.hayvanlar.filter(h => h.adet > 0);
    aktif.forEach(h => {
      // Tür adını normalize et ve kolon bul
      const kolNo = Object.entries(TUR_KOLON).find(([k]) =>
        h.tur_adi.toLowerCase().includes(k.toLowerCase().split(' ').slice(-1)[0].toLowerCase())
        && k.toLowerCase().split(' ').some(w => h.tur_adi.toLowerCase().includes(w))
      );
      if (kolNo) {
        row.getCell(kolNo[1]).value = h.adet;
        style(row.getCell(kolNo[1]), { border:true });
      }
    });
    row.getCell(14).value = kayit.toplam_bbhb;
    row.getCell(14).numFmt = '#,##0.00';
    style(row.getCell(14), { bold:true, border:true });

    // Toplam satırı
    const totRow = ws.getRow(satir + 1);
    totRow.height = 22;
    ws.mergeCells(`A${satir+1}:B${satir+1}`);
    totRow.getCell(1).value = 'TOPLAM';
    style(totRow.getCell(1), { bold:true, bg:LIGHTGREEN, align:'center', border:true });
    for (let col = 3; col <= 13; col++) {
      const cell = totRow.getCell(col);
      // Sütun toplamı
      const v = ws.getRow(satir).getCell(col).value;
      cell.value = v || null;
      style(cell, { bold:true, bg:LIGHTGREEN, border:true });
    }
    totRow.getCell(14).value = kayit.toplam_bbhb;
    totRow.getCell(14).numFmt = '#,##0.00';
    style(totRow.getCell(14), { bold:true, bg:LIGHTGREEN, border:true });

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

    // Ayarlardan yararlanılabilir yeşil ot verimi ortalaması
    const Ayarlar = require('../ayarlar/ayarlar.model');
    const ayarlar = await Ayarlar.findOne().select('yararlanilabilir_yesil_ot');
    const verimTablosu = ayarlar?.yararlanilabilir_yesil_ot || [];

    // "İyi" vasıf mera verimi ortalaması (kg/da)
    let verimOrtalama = null;
    let verimMin = null;
    let verimMax = null;
    if (verimTablosu.length > 0) {
      const iyiDegerler = verimTablosu.map(s => s.iyi).filter(v => v != null && v > 0);
      if (iyiDegerler.length > 0) {
        verimOrtalama = iyiDegerler.reduce((a,b) => a+b, 0) / iyiDegerler.length;
        verimMin = Math.min(...iyiDegerler);
        verimMax = Math.max(...iyiDegerler);
      }
    }

    // Gerekli mera alanı = BBHB × 180 gün × 50 kg/gün ÷ verim (kg/da)
    // verim yoksa 10-12 da/BBHB sabit aralık kullan
    const gunlukYem = 50; // kg/BBHB/gün
    const otlatmaSuresi = 180; // gün
    const toplamYemKg = kayit.toplam_bbhb * gunlukYem * otlatmaSuresi;

    let meraAlanMetni;
    if (verimOrtalama && verimMin && verimMax) {
      const alanMin = (toplamYemKg / verimMax).toFixed(1);
      const alanMax = (toplamYemKg / verimMin).toFixed(1);
      const alanOrt = (toplamYemKg / verimOrtalama).toFixed(1);
      meraAlanMetni = `${Number(alanMin).toLocaleString('tr-TR')} – ${Number(alanMax).toLocaleString('tr-TR')} da
        <span class="aciklama">(verim: ${verimMin}–${verimMax} kg/da; ort. ${alanOrt.toLocaleString('tr-TR')} da)</span>`;
    } else {
      const alanMin = (kayit.toplam_bbhb * 10).toLocaleString('tr-TR', {minimumFractionDigits:1, maximumFractionDigits:1});
      const alanMax = (kayit.toplam_bbhb * 12).toLocaleString('tr-TR', {minimumFractionDigits:1, maximumFractionDigits:1});
      meraAlanMetni = `${alanMin} – ${alanMax} da <span class="aciklama">(10–12 da/BBHB, sabit oran)</span>`;
    }

    const aktif = kayit.hayvanlar.filter(h => h.adet > 0);
    const tarih = new Date(kayit.createdAt).toLocaleDateString('tr-TR');

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>BBHB Raporu</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:Arial,sans-serif;font-size:11pt;color:#222;padding:16mm 20mm}
    h1{font-size:13pt;text-align:center;margin-bottom:6mm;color:#0F6E56;text-transform:uppercase;border-bottom:2px solid #0F6E56;padding-bottom:3mm}
    .meta{margin-bottom:5mm;font-size:10pt;display:flex;gap:20mm;flex-wrap:wrap}
    .meta div{display:flex;gap:4px}
    .meta strong{color:#333;min-width:80px}
    table{width:100%;border-collapse:collapse;margin-bottom:4mm;font-size:10pt}
    th{background:#0F6E56;color:#fff;padding:5pt 8pt;text-align:left}
    th.r{text-align:right}th.c{text-align:center}
    td{padding:4pt 8pt;border-bottom:1px solid #e0e0e0}
    td.c{text-align:center}td.r{text-align:right}
    tr:nth-child(even) td{background:#f5faf7}
    .toplam td{font-weight:bold;border-top:2px solid #0F6E56;background:#e1f5ee}
    .ozet{margin-top:5mm;padding:5mm 6mm;background:#e1f5ee;border-radius:5px;border-left:4px solid #0F6E56}
    .ozet-baslik{font-weight:bold;color:#0F6E56;font-size:10.5pt;margin-bottom:4mm}
    .ozet-tablo{width:100%;border-collapse:collapse}
    .ozet-tablo td{border:none;background:none;padding:2pt 6pt;vertical-align:top}
    .etiket{display:block;font-size:8pt;color:#555;margin-bottom:1pt}
    .deger{display:block;font-weight:bold;font-size:10.5pt;color:#0a3622}
    .mera-satir td{padding-top:5pt;border-top:1px solid #c0ddd0}
    .mera-deger{font-size:12pt !important;color:#0F6E56 !important}
    .aciklama{font-size:8pt;color:#666;font-weight:normal;margin-left:4px}
    .footer{margin-top:8mm;font-size:9pt;color:#aaa;text-align:center;border-top:1px solid #ddd;padding-top:3mm}
    @media print{body{padding:10mm 14mm}}
  </style>
</head>
<body>
  <h1>Büyükbaş Hayvan Birimi (BBHB) Raporu</h1>
  <div class="meta">
    ${kayit.baslik ? `<div><strong>Başlık:</strong><span>${kayit.baslik}</span></div>` : ''}
    ${kayit.ciftci_ad ? `<div><strong>İşletmeci:</strong><span>${kayit.ciftci_ad}</span></div>` : ''}
    <div><strong>Tarih:</strong><span>${tarih}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Hayvan Türü</th>
        <th class="c">Katsayı</th>
        <th class="c">Adet</th>
        <th class="r">BBHB</th>
      </tr>
    </thead>
    <tbody>
      ${aktif.map(h => `<tr>
        <td>${h.tur_adi}</td>
        <td class="c">${h.katsayi}</td>
        <td class="c">${h.adet}</td>
        <td class="r">${h.bbhb.toFixed(2)}</td>
      </tr>`).join('')}
      <tr class="toplam">
        <td colspan="2">TOPLAM</td>
        <td class="c">${kayit.toplam_adet}</td>
        <td class="r">${kayit.toplam_bbhb.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <div class="ozet">
    <div class="ozet-baslik">Özet Bilgiler</div>
    <table class="ozet-tablo">
      <tr>
        <td><span class="etiket">Toplam Hayvan Sayısı</span><span class="deger">${kayit.toplam_adet.toLocaleString('tr-TR')} baş</span></td>
        <td><span class="etiket">Toplam BBHB</span><span class="deger">${kayit.toplam_bbhb.toFixed(2)}</span></td>
        <td><span class="etiket">Aktif Tür Sayısı</span><span class="deger">${aktif.length}</span></td>
      </tr>
      <tr>
        <td><span class="etiket">Tahmini Canlı Ağırlık</span><span class="deger">${(kayit.toplam_bbhb * 500).toLocaleString('tr-TR')} kg</span></td>
        <td><span class="etiket">Yeşil Kaba Yem (180 gün)</span><span class="deger">${(kayit.toplam_bbhb * 50 * 180).toLocaleString('tr-TR')} kg</span></td>
        <td><span class="etiket">Kuru Kaba Yem (180 gün)</span><span class="deger">${(kayit.toplam_bbhb * 12.5 * 180).toLocaleString('tr-TR')} kg</span></td>
      </tr>
      <tr>
        <td colspan="3" class="mera-satir">
          <span class="etiket">180 Günlük Dönem İçin Gerekli İyi Vasıf Mera Miktarı (${otlatmaSuresi} gün × ${gunlukYem} kg/BBHB/gün)</span>
          <span class="deger mera-deger">${meraAlanMetni}</span>
        </td>
      </tr>
    </table>
  </div>
  <div class="footer">MİS – Mera İzleme Sistemi</div>
  <script>window.onload=()=>window.print();<\/script>
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
          ...(kayit.ciftci_ad ? [new Paragraph(`İşletmeci: ${kayit.ciftci_ad}`)] : []),
          new Paragraph(`Tarih: ${new Date(kayit.createdAt).toLocaleDateString('tr-TR')}`),
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
