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

    const GREEN  = 'FF0F6E56';
    const GREEN2 = 'FF1D9E75';
    const WHITE  = 'FFFFFFFF';
    const LGREEN = 'FFE1F5EE';

    ws.columns = [
      {width:6},{width:32},{width:9},{width:9},{width:9},{width:9},
      {width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:12},
    ];

    const stl = (cell, bg, color, bold, align, border) => {
      if (bg) cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:bg}};
      cell.font = {bold:!!bold, color:{argb:color||'FF000000'}, size:10};
      cell.alignment = {horizontal:align||'center',vertical:'middle',wrapText:true};
      if (border) { const b={style:'thin',color:{argb:'FFCCCCCC'}}; cell.border={top:b,bottom:b,left:b,right:b}; }
    };

    // Satır 1: Yer bilgisi
    const yer = [kayit.il,kayit.ilce,kayit.mahalle].filter(Boolean)
      .map((v,i)=> i===0?v+' İli':i===1?v+' İlçesi':v+' Mahallesi/Köyü').join(' ');
    ws.mergeCells('A1:N1');
    ws.getCell('A1').value = yer || 'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) HESAPLAMA';
    stl(ws.getCell('A1'), GREEN, WHITE, true, 'center'); ws.getRow(1).height = 22;

    // Satır 2: Başlık
    ws.mergeCells('A2:N2');
    ws.getCell('A2').value = 'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU';
    stl(ws.getCell('A2'), GREEN, WHITE, true, 'center'); ws.getRow(2).height = 22;

    // Satır 3: Tarih
    ws.mergeCells('A3:G3'); ws.getCell('A3').value = 'Tarih: ' + new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    stl(ws.getCell('A3'), null, null, false, 'left'); ws.getRow(3).height = 16;

    // Satır 4: Üst tablo başlığı
    ws.mergeCells('A4:A6'); ws.getCell('A4').value = 'Sıra\nNo';
    stl(ws.getCell('A4'), GREEN, WHITE, true);
    ws.mergeCells('B4:B6'); ws.getCell('B4').value = 'İkamet Eden Aile Temsilcisinin\nAdı Soyadı (Aile)';
    stl(ws.getCell('B4'), GREEN, WHITE, true);
    ws.mergeCells('C4:N4'); ws.getCell('C4').value = 'Büyükbaş, Küçükbaş ve Diğer Hayvan Varlıkları';
    stl(ws.getCell('C4'), GREEN, WHITE, true); ws.getRow(4).height = 26;

    // Satır 5: Grup başlıkları
    [['C5:D5','Kültür Irkı'],['E5:F5','Kültür Melezi'],['G5:H5','Yerli Irk'],
     ['I5:K5','Küçükbaş'],['L5:M5','Tek Tırnaklı']].forEach(([r,v]) => {
      ws.mergeCells(r); ws.getCell(r.split(':')[0]).value = v;
      stl(ws.getCell(r.split(':')[0]), GREEN2, WHITE, true);
    });
    ws.mergeCells('N5:N6'); ws.getCell('N5').value = 'Toplam\nBBHB';
    stl(ws.getCell('N5'), GREEN2, WHITE, true); ws.getRow(5).height = 18;

    // Satır 6: Alt başlıklar
    [['C6','İnek'],['D6','Da-Dü'],['E6','İnek'],['F6','Da-Dü'],['G6','İnek'],['H6','Da-Dü'],
     ['I6','Koyun'],['J6','Kuzu'],['K6','Keçi'],['L6','At'],['M6','Eşek']].forEach(([c,v]) => {
      ws.getCell(c).value = v; stl(ws.getCell(c), GREEN2, WHITE, true);
    }); ws.getRow(6).height = 18;

    // Kategori → sütun eşleşmesi
    const KAT_COL = {
      'Kültür ırkı süt ineği':3,'Dana-düve (kültür ırkı)':4,
      'Kültür melezi':5,'Dana-düve (kültür melezi)':6,
      'Yerli inek':7,'Dana-düve (yerli)':8,
      'Koyun':9,'Kuzu-oğlak':10,'Keçi':11,'At':12,'Eşek':13,
    };

    const isletmeciler = Array.isArray(kayit.isletmeciler) && kayit.isletmeciler.length > 0
      ? kayit.isletmeciler
      : [{ sahip: kayit.ciftci_ad||'-', kategoriler: Object.fromEntries(
           kayit.hayvanlar.filter(h=>h.adet>0).map(h=>[h.tur_adi,{adet:h.adet,bbhb:h.bbhb}])
         ), toplam_adet: kayit.toplam_adet, toplam_bbhb: kayit.toplam_bbhb }];

    const toplamKol = {};
    isletmeciler.forEach((ist, idx) => {
      const satirNo = 7 + idx;
      const row = ws.getRow(satirNo);
      row.height = 18;
      row.getCell(1).value = idx + 1; stl(row.getCell(1), idx%2?'FFF5FAF7':null, null, false, 'center', true);
      row.getCell(2).value = ist.sahip||'—'; stl(row.getCell(2), idx%2?'FFF5FAF7':null, null, false, 'left', true);
      for (let c=3;c<=13;c++) { row.getCell(c).value=null; stl(row.getCell(c), idx%2?'FFF5FAF7':null, null, false, 'center', true); }
      Object.entries(ist.kategoriler||{}).forEach(([kat,v]) => {
        const col = KAT_COL[kat]; if (!col) return;
        row.getCell(col).value = v.adet || null;
        stl(row.getCell(col), idx%2?'FFF5FAF7':null, null, false, 'center', true);
        toplamKol[col] = (toplamKol[col]||0) + (v.adet||0);
      });
      row.getCell(14).value = ist.toplam_bbhb;
      row.getCell(14).numFmt = '#,##0.00';
      stl(row.getCell(14), idx%2?'FFF5FAF7':null, null, true, 'right', true);
    });

    // Toplam satırı
    const totR = 7 + isletmeciler.length;
    const totRow = ws.getRow(totR); totRow.height = 20;
    ws.mergeCells(`A${totR}:B${totR}`);
    totRow.getCell(1).value = 'TOPLAM'; stl(totRow.getCell(1), LGREEN, null, true, 'center', true);
    for (let c=3;c<=13;c++) {
      totRow.getCell(c).value = toplamKol[c]||null;
      stl(totRow.getCell(c), LGREEN, null, true, 'center', true);
    }
    totRow.getCell(14).value = kayit.toplam_bbhb; totRow.getCell(14).numFmt = '#,##0.00';
    stl(totRow.getCell(14), LGREEN, null, true, 'right', true);

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=bbhb_${kayit._id}.xlsx`);
    await wb.xlsx.write(res); res.end();
  } catch (err) { next(err); }
};

const pdfRapor = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });

    // Ayarlardan il bazlı mera verimi hesapla
    const Ayarlar = require('../ayarlar/ayarlar.model');
    const ayarlar = await Ayarlar.findOne().select('yagis_kusaklari yararlanilabilir_yesil_ot');

    const gunlukYem = 50;    // kg/BBHB/gün
    const otlatmaSuresi = 180; // gün
    const toplamYemKg = kayit.toplam_bbhb * gunlukYem * otlatmaSuresi;

    let meraAlanMetni;
    const il = kayit.il || '';

    if (il && ayarlar?.yagis_kusaklari?.length && ayarlar?.yararlanilabilir_yesil_ot?.length) {
      // İlin yağış kuşağını bul
      const ilKusagi = ayarlar.yagis_kusaklari.find(
        k => k.il_ad && k.il_ad.toLowerCase().trim() === il.toLowerCase().trim()
      );
      if (ilKusagi) {
        // O kuşağın iyi vasıf verim değerini bul
        const verimSatir = ayarlar.yararlanilabilir_yesil_ot.find(
          v => v.kusak === ilKusagi.kusak
        );
        if (verimSatir?.iyi) {
          const alan = (toplamYemKg / verimSatir.iyi).toFixed(1);
          meraAlanMetni = `${Number(alan).toLocaleString('tr-TR')} da
            <span class="aciklama">(${il} ili ${ilKusagi.kusak} mm yağış kuşağı, iyi vasıf verim: ${verimSatir.iyi} kg/da)</span>`;
        }
      }
    }

    if (!meraAlanMetni) {
      // Genel ortalama fallback
      const iyiDegerler = (ayarlar?.yararlanilabilir_yesil_ot||[]).map(s=>s.iyi).filter(v=>v>0);
      if (iyiDegerler.length > 0) {
        const ort = iyiDegerler.reduce((a,b)=>a+b,0)/iyiDegerler.length;
        const min = Math.min(...iyiDegerler), max = Math.max(...iyiDegerler);
        meraAlanMetni = `${(toplamYemKg/max).toFixed(1).toLocaleString?.()??((toplamYemKg/max).toFixed(1))} – ${(toplamYemKg/min).toFixed(1)} da
          <span class="aciklama">(genel ort. ${(toplamYemKg/ort).toFixed(1)} da; verim: ${min}–${max} kg/da)</span>`;
      } else {
        const a1=(kayit.toplam_bbhb*10).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
        const a2=(kayit.toplam_bbhb*12).toLocaleString('tr-TR',{minimumFractionDigits:1,maximumFractionDigits:1});
        meraAlanMetni = `${a1} – ${a2} da <span class="aciklama">(10–12 da/BBHB sabit oran)</span>`;
      }
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

    const tarih = new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    const yer = [
      kayit.il      ? kayit.il      + ' İli'            : '',
      kayit.ilce    ? kayit.ilce    + ' İlçesi'          : '',
      kayit.mahalle ? kayit.mahalle + ' Mahallesi/Köyü'  : '',
    ].filter(Boolean).join(' ');

    const isletmeciler = Array.isArray(kayit.isletmeciler) && kayit.isletmeciler.length > 0
      ? kayit.isletmeciler
      : [{ sahip: kayit.ciftci_ad||'-', kategoriler: Object.fromEntries(
           kayit.hayvanlar.filter(h=>h.adet>0).map(h=>[h.tur_adi,{adet:h.adet,bbhb:h.bbhb}])
         ), toplam_bbhb: kayit.toplam_bbhb }];

    const KAT_COL = {
      'Kültür ırkı süt ineği':3,'Dana-düve (kültür ırkı)':4,
      'Kültür melezi':5,'Dana-düve (kültür melezi)':6,
      'Yerli inek':7,'Dana-düve (yerli)':8,
      'Koyun':9,'Kuzu-oğlak':10,'Keçi':11,'At':12,'Eşek':13,
    };
    const KOLON_BASLIK = ['Kü.Irkı İnek','Kü.Irkı Da-Dü','Melez İnek','Melez Da-Dü',
      'Yerli İnek','Yerli Da-Dü','Koyun','Kuzu','Keçi','At','Eşek'];

    const hucre = (text, bold=false, bg=null) => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(text||''), bold, size:18 })],
        alignment: AlignmentType.CENTER })],
      shading: bg ? { type:'solid', color:bg, fill:bg } : undefined,
      margins: { top:40, bottom:40, left:60, right:60 },
    });

    const GREEN = '0F6E56';
    const GREEN2 = '1D9E75';
    const LGREEN = 'E1F5EE';

    // Başlık satırları
    const baslikSatiri1 = new TableRow({ children: [
      hucre('No', true, GREEN),
      hucre('İkamet Eden Aile Temsilcisinin Adı Soyadı (Aile)', true, GREEN),
      new TableCell({ children: [new Paragraph({ children:[new TextRun({text:'Büyükbaş, Küçükbaş ve Diğer Hayvan Varlıkları',bold:true,size:18,color:'FFFFFF'})], alignment:AlignmentType.CENTER })],
        columnSpan:12, shading:{type:'solid',color:GREEN,fill:GREEN}, margins:{top:40,bottom:40,left:60,right:60} }),
    ]});
    const baslikSatiri2 = new TableRow({ children: [
      hucre('', true, GREEN2), hucre('', true, GREEN2),
      new TableCell({ children:[new Paragraph({children:[new TextRun({text:'Kültür Irkı',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})], columnSpan:2, shading:{type:'solid',color:GREEN2,fill:GREEN2}, margins:{top:40,bottom:40,left:60,right:60} }),
      new TableCell({ children:[new Paragraph({children:[new TextRun({text:'Kültür Melezi',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})], columnSpan:2, shading:{type:'solid',color:GREEN2,fill:GREEN2}, margins:{top:40,bottom:40,left:60,right:60} }),
      new TableCell({ children:[new Paragraph({children:[new TextRun({text:'Yerli Irk',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})], columnSpan:2, shading:{type:'solid',color:GREEN2,fill:GREEN2}, margins:{top:40,bottom:40,left:60,right:60} }),
      new TableCell({ children:[new Paragraph({children:[new TextRun({text:'Küçükbaş',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})], columnSpan:3, shading:{type:'solid',color:GREEN2,fill:GREEN2}, margins:{top:40,bottom:40,left:60,right:60} }),
      new TableCell({ children:[new Paragraph({children:[new TextRun({text:'Tek Tırnaklı',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})], columnSpan:2, shading:{type:'solid',color:GREEN2,fill:GREEN2}, margins:{top:40,bottom:40,left:60,right:60} }),
      hucre('Top.BBHB', true, GREEN2),
    ]});
    const baslikSatiri3 = new TableRow({ children: [
      hucre('', true, GREEN2), hucre('', true, GREEN2),
      ...KOLON_BASLIK.map(b => hucre(b, true, GREEN2)),
    ]});

    // Veri satırları
    const toplamKol = {};
    const veriSatirlari = isletmeciler.map((ist, idx) => {
      const kd = {};
      Object.entries(ist.kategoriler||{}).forEach(([kat,v])=>{ const c=KAT_COL[kat]; if(c){kd[c]=(kd[c]||0)+(v.adet||0); toplamKol[c]=(toplamKol[c]||0)+(v.adet||0);} });
      const bg = idx%2===1 ? 'F5FAF7' : null;
      return new TableRow({ children: [
        hucre(idx+1, false, bg),
        new TableCell({ children:[new Paragraph({children:[new TextRun({text:ist.sahip||'—',size:18})],alignment:AlignmentType.LEFT})], shading:bg?{type:'solid',color:bg,fill:bg}:undefined, margins:{top:40,bottom:40,left:80,right:60} }),
        ...[3,4,5,6,7,8,9,10,11,12,13].map(c => hucre(kd[c]||'', false, bg)),
        hucre(ist.toplam_bbhb?.toFixed(2)||'', true, bg),
      ]});
    });

    // Toplam satırı
    const toplamSatiri = new TableRow({ children: [
      new TableCell({ children:[new Paragraph({children:[new TextRun({text:'TOPLAM',bold:true,size:18})],alignment:AlignmentType.CENTER})], columnSpan:2, shading:{type:'solid',color:LGREEN,fill:LGREEN}, margins:{top:40,bottom:40,left:60,right:60} }),
      ...[3,4,5,6,7,8,9,10,11,12,13].map(c => hucre(toplamKol[c]||'', true, LGREEN)),
      hucre(kayit.toplam_bbhb?.toFixed(2)||'', true, LGREEN),
    ]});

    const doc = new Document({
      sections: [{ properties:{page:{margin:{top:720,right:720,bottom:720,left:720}}}, children: [
        ...(yer ? [new Paragraph({ children:[new TextRun({text:yer,bold:false,size:22})], alignment:AlignmentType.CENTER, spacing:{after:80} })] : []),
        new Paragraph({ children:[new TextRun({text:'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU',bold:true,size:26,color:'0F6E56'})], alignment:AlignmentType.CENTER, spacing:{after:80} }),
        new Paragraph({ children:[new TextRun({text:`Tarih: ${tarih}`,size:20})], spacing:{after:160} }),
        new Table({ width:{size:100,type:WidthType.PERCENTAGE}, rows:[baslikSatiri1,baslikSatiri2,baslikSatiri3,...veriSatirlari,toplamSatiri] }),
      ]}],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition',`attachment; filename=bbhb_${kayit._id}.docx`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = { getTurler, hesapla, kaydet, listele, getById, sil, excelRapor, pdfRapor, wordRapor, HAYVAN_TURLERI };
