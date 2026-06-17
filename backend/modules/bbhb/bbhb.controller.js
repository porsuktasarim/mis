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

    // Yer bilgisi
    const yerParcalari = [
      kayit.il      ? `<strong>${kayit.il} İli</strong>`      : '',
      kayit.ilce    ? `<strong>${kayit.ilce} İlçesi</strong>`  : '',
      kayit.mahalle ? `<strong>${kayit.mahalle} Mahallesi/Köyü</strong>` : '',
    ].filter(Boolean);
    const yerSatiri = yerParcalari.join(' ');

    // İşletmeci listesi
    const isletmecilerArr = Array.isArray(kayit.isletmeciler) && kayit.isletmeciler.length > 0
      ? kayit.isletmeciler : null;

    // Sütun eşleşme tablosu
    const KAT_KOLON = {
      'Kültür ırkı süt ineği':     'Kültür Irkı İnek',
      'Dana-düve (kültür ırkı)':   'Kültür Irkı Da-Dü',
      'Kültür melezi':              'Kültür Melezi İnek',
      'Dana-düve (kültür melezi)':  'Kültür Melezi Da-Dü',
      'Yerli inek':                 'Yerli Irk İnek',
      'Dana-düve (yerli)':          'Yerli Irk Da-Dü',
      'Koyun':                      'Koyun',
      'Kuzu-oğlak':                 'Kuzu',
      'Keçi':                       'Keçi',
      'At':                         'At',
      'Eşek':                       'Eşek',
    };
    const KOLONLAR = ['Kültür Irkı İnek','Kültür Irkı Da-Dü','Kültür Melezi İnek',
      'Kültür Melezi Da-Dü','Yerli Irk İnek','Yerli Irk Da-Dü','Koyun','Kuzu','Keçi','At','Eşek'];

    const katToKolon = (kategoriler) => {
      const kd = {};
      Object.entries(kategoriler||{}).forEach(([kat, v]) => {
        const k = KAT_KOLON[kat]; if (k) kd[k] = (kd[k]||0) + v.adet;
      });
      return kd;
    };

    // Veri satırları
    const toplamKolon = {};
    const dataSatirlari = isletmecilerArr
      ? isletmecilerArr.map((ist, idx) => {
          const kd = katToKolon(ist.kategoriler);
          KOLONLAR.forEach(k => { if(kd[k]) toplamKolon[k]=(toplamKolon[k]||0)+kd[k]; });
          return `<tr class="${idx%2===1?'alt':''}">
            <td class="c">${idx+1}</td><td class="l">${ist.sahip||'—'}</td>
            ${KOLONLAR.map(k=>`<td class="c">${kd[k]||''}</td>`).join('')}
            <td class="r fw">${ist.toplam_bbhb.toFixed(2)}</td>
          </tr>`;
        }).join('')
      : (() => {
          const kd = katToKolon(Object.fromEntries(aktif.map(h=>([h.tur_adi,{adet:h.adet,bbhb:h.bbhb}]))));
          KOLONLAR.forEach(k => { if(kd[k]) toplamKolon[k]=(toplamKolon[k]||0)+kd[k]; });
          return `<tr><td class="c">1</td><td class="l">${kayit.ciftci_ad||'—'}</td>
            ${KOLONLAR.map(k=>`<td class="c">${kd[k]||''}</td>`).join('')}
            <td class="r fw">${kayit.toplam_bbhb.toFixed(2)}</td></tr>`;
        })();

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:8.5pt;color:#111;padding:10mm 12mm}
.yer{font-size:9.5pt;text-align:center;margin-bottom:2mm;color:#333}
h1{font-size:11pt;font-weight:bold;text-align:center;margin-bottom:3mm;color:#0F6E56;text-transform:uppercase;border-bottom:2px solid #0F6E56;padding-bottom:2mm}
.meta{margin-bottom:2mm;font-size:8.5pt;display:flex;gap:8mm}
table{width:100%;border-collapse:collapse;margin-bottom:3mm;font-size:8pt}
.ust th{background:#0F6E56;color:#fff;text-align:center;padding:3pt 3pt;border:1px solid rgba(255,255,255,0.3)}
th{background:#1D9E75;color:#fff;text-align:center;padding:2pt 2pt;border:1px solid rgba(255,255,255,0.3)}
td{padding:2pt 3pt;border:1px solid #e0e0e0;vertical-align:middle}
td.c{text-align:center}td.r{text-align:right}td.l{text-align:left}td.fw{font-weight:bold}
tr.alt td{background:#f5faf7}
.toplam td{font-weight:bold;background:#e1f5ee;border-top:2px solid #0F6E56}
.ozet{margin-top:3mm;padding:3mm 4mm;background:#e1f5ee;border-radius:4px;border-left:3px solid #0F6E56;font-size:8pt}
.ozet-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin-bottom:2mm}
.etiket{font-size:7pt;color:#555}
.deger{font-weight:bold;font-size:9.5pt;color:#0a3622}
.mera{margin-top:2mm;padding:2mm 3mm;background:#c8ead8;border-radius:3px}
.mera .etiket{font-size:7.5pt;color:#0a3622}
.mera .deger{font-size:11pt;font-weight:bold;color:#0F6E56}
.aciklama{font-size:7pt;color:#666}
.footer{margin-top:4mm;font-size:7.5pt;color:#aaa;text-align:center;border-top:1px solid #ddd;padding-top:2mm}
@media print{body{padding:6mm 8mm}}
</style></head><body>
${yerSatiri ? `<div class="yer">${yerSatiri}</div>` : ''}
<h1>Büyükbaş Hayvan Birimi (BBHB) Raporu</h1>
<div class="meta"><span><strong>Tarih:</strong> ${tarih}</span>${kayit.il?`<span><strong>İl:</strong> ${kayit.il}</span>`:''}</div>
<table>
  <thead>
    <tr class="ust">
      <th rowspan="2" style="width:25px">Sıra No</th>
      <th rowspan="2" style="min-width:140px">İkamet Eden Aile Temsilcisinin Adı Soyadı (Aile)</th>
      <th colspan="2">Kültür Irkı</th><th colspan="2">Kültür Melezi</th>
      <th colspan="2">Yerli Irk</th><th colspan="3">Küçükbaş</th>
      <th colspan="2">Tek Tırnaklı</th>
      <th rowspan="2">Toplam BBHB</th>
    </tr>
    <tr>
      <th>İnek</th><th>Da-Dü</th><th>İnek</th><th>Da-Dü</th>
      <th>İnek</th><th>Da-Dü</th><th>Koyun</th><th>Kuzu</th><th>Keçi</th>
      <th>At</th><th>Eşek</th>
    </tr>
  </thead>
  <tbody>
    ${dataSatirlari}
    <tr class="toplam">
      <td colspan="2" class="c">TOPLAM</td>
      ${KOLONLAR.map(k=>`<td class="c">${toplamKolon[k]||''}</td>`).join('')}
      <td class="r">${kayit.toplam_bbhb.toFixed(2)}</td>
    </tr>
  </tbody>
</table>
<div class="ozet">
  <div class="ozet-grid">
    <div><div class="etiket">Toplam Hayvan Sayısı</div><div class="deger">${kayit.toplam_adet.toLocaleString('tr-TR')} baş</div></div>
    <div><div class="etiket">Toplam BBHB</div><div class="deger">${kayit.toplam_bbhb.toFixed(2)}</div></div>
    <div><div class="etiket">İşletmeci Sayısı</div><div class="deger">${isletmecilerArr?isletmecilerArr.length:1}</div></div>
    <div><div class="etiket">Tahmini Canlı Ağırlık</div><div class="deger">${(kayit.toplam_bbhb*500).toLocaleString('tr-TR')} kg</div></div>
    <div><div class="etiket">Yeşil Kaba Yem (180 gün)</div><div class="deger">${(kayit.toplam_bbhb*50*180).toLocaleString('tr-TR')} kg</div></div>
    <div><div class="etiket">Kuru Kaba Yem (180 gün)</div><div class="deger">${(kayit.toplam_bbhb*12.5*180).toLocaleString('tr-TR')} kg</div></div>
  </div>
  <div class="mera">
    <div class="etiket">180 Günlük Dönem İçin Gerekli İyi Vasıf Mera Miktarı${kayit.il?' ('+kayit.il+' ili değerleri)':''} &nbsp;(${otlatmaSuresi} gün × ${gunlukYem} kg/BBHB/gün)</div>
    <div class="deger">${meraAlanMetni}</div>
  </div>
</div>
<div class="footer">MİS – Mera İzleme Sistemi &nbsp;|&nbsp; ${tarih}</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;

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
