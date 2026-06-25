/**
 * Ek-4/ab Raporu
 * Tahsis Çalışmalarına Esas Olacak
 * Çiftçi Aile Bildirimi (4-a) + Hayvan Varlığı Cetveli (4-b)
 *
 * POST /api/ttt/:id/rapor/ek4ab
 * Body: { bbhb_id, cks_id }
 */
const ExcelJS = require('exceljs');
const { Document, Packer, Paragraph, Table, TableRow, TableCell,
        TextRun, AlignmentType, WidthType } = require('docx');

// BBHB tablosundaki sütun sırası (sistemdeki TABLO_SUTUNLARI ile aynı)
// Ek-4/ab'deki sıra: Kültür İnek, Kültür Dana-Düve, Kültür Melezi İnek,
// Kültür Melezi Dana-Düve, Yerli İnek, Yerli Dana-Düve,
// Koyun, Keçi, Manda Erkek, Manda Dişi, Boğa
const EK4B_KOLONLAR = [
  { key: 'Kültür İnek',              kisa: 'İnek',       grup: 'Kültür' },
  { key: 'Kültür Dana-Düve',         kisa: 'Dana-Düve',  grup: 'Kültür' },
  { key: 'Kültür Melezi İnek',       kisa: 'İnek',       grup: 'Kültür Melezi' },
  { key: 'Kültür Melezi Dana-Düve',  kisa: 'Dana-Düve',  grup: 'Kültür Melezi' },
  { key: 'Yerli İnek',               kisa: 'İnek',       grup: 'Yerli' },
  { key: 'Yerli Dana-Düve',          kisa: 'Dana-Düve',  grup: 'Yerli' },
  { key: 'Koyun',                    kisa: 'Koyun',      grup: 'Küçükbaş' },
  { key: 'Keçi',                     kisa: 'Keçi',       grup: 'Küçükbaş' },
  { key: 'Manda Erkek',              kisa: 'Erkek',      grup: 'Manda' },
  { key: 'Manda Dişi',               kisa: 'Dişi',       grup: 'Manda' },
  { key: 'Boğa',                     kisa: 'Boğa',       grup: 'Diğer' },
];

// Mevcut gruplar (colspan için)
const EK4B_GRUPLARI = [
  { ad: 'Kültür',         span: 2 },
  { ad: 'Kültür Melezi',  span: 2 },
  { ad: 'Yerli',          span: 2 },
  { ad: 'Küçük Baş',      span: 2 },
  { ad: 'Manda',          span: 2 },
  { ad: 'Boğa',           span: 1 },
];

const ek4abExcel = async (req, res, next) => {
  try {
    const Tahsis      = require('../tahsis/tahsis.model');
    const BBHBHesap   = require('../bbhb/bbhb.model');
    const CksYukle    = require('../cks/cks.model');

    const ttt = await Tahsis.findById(req.params.id);
    if (!ttt) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });

    const { bbhb_id, cks_id } = req.body;

    // BBHB ve ÇKS verilerini çek
    const [bbhb, cks] = await Promise.all([
      bbhb_id ? BBHBHesap.findById(bbhb_id) : null,
      cks_id  ? CksYukle.findById(cks_id)   : null,
    ]);

    // İşletmeci listesi: BBHB'den
    const isletmeciler = bbhb
      ? (Array.isArray(bbhb.isletmeciler) && bbhb.isletmeciler.length > 0
          ? bbhb.isletmeciler
          : [{ sahip: bbhb.ciftci_ad||'–', kategoriler: Object.fromEntries(
                 (bbhb.hayvanlar||[]).filter(h=>h.adet>0).map(h=>[h.tur_adi,{adet:h.adet}])
               ), toplam_bbhb: bbhb.toplam_bbhb }])
      : [];

    // ÇKS kişi haritası: AD → {yem, sebze, hububat}
    const cksMap = {};
    if (cks && cks.kisiler) {
      cks.kisiler.forEach(k => {
        cksMap[k.ad_soyad.toUpperCase().trim()] = k;
      });
    }
    const uretimYili = cks?.uretim_yili || new Date().getFullYear();

    // Excel oluştur
    const wb = new ExcelJS.Workbook();
    wb.creator = 'MİS – Mera İzleme Sistemi';
    const ws = wb.addWorksheet('Ek-4ab');

    const G1='FF0F6E56', G2='FF1D9E75', WH='FFFFFFFF', LG='FFE1F5EE', YL='FFFFF8E1';
    const N_HAYVAN = EK4B_KOLONLAR.length; // 11
    // Toplam sütun: Sıra(1) + AdSoyad(1) + Ekiliş(3) + GeçimKaynağı(2) + Hayvan(11) + BBHB(1) = 19
    const N_TOTAL = 1 + 1 + 3 + 2 + N_HAYVAN + 1; // 19

    // Sütun genişlikleri
    ws.columns = [
      { width: 5 },  // Sıra
      { width: 28 }, // Ad Soyad
      { width: 9 },  // Yem Bitkisi
      { width: 9 },  // Sebze-Bağ
      { width: 9 },  // Hububat
      { width: 9 },  // Geçim: Tarım
      { width: 9 },  // Geçim: Hayvancılık
      ...EK4B_KOLONLAR.map(() => ({ width: 8 })),  // Hayvan sütunları
      { width: 10 }, // BBHB Toplam
    ];

    const s = (cell, bg, color, bold, align) => {
      if (bg) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:bg } };
      cell.font = { bold:!!bold, color:{ argb:color||'FF000000' }, size: 9 };
      cell.alignment = { horizontal: align||'center', vertical:'middle', wrapText:true };
      const b = { style:'thin', color:{ argb:'FFCCCCCC' } };
      cell.border = { top:b, bottom:b, left:b, right:b };
    };

    const lastCol = String.fromCharCode(64 + N_TOTAL);

    // ── Satır 1: (Ek-4/a, Ek-4/b) etiketi ──────────────
    ws.mergeCells(`A1:${lastCol}1`);
    ws.getCell('A1').value = '(Ek-4/a, Ek-4/b)';
    s(ws.getCell('A1'), null, 'FF666666', false, 'left'); ws.getRow(1).height = 14;

    // ── Satır 2: Ana başlık ──────────────────────────────
    ws.mergeCells(`A2:${lastCol}2`);
    ws.getCell('A2').value = 'TAHSİS ÇALIŞMALARINA ESAS OLACAK';
    s(ws.getCell('A2'), G1, WH, true, 'center'); ws.getRow(2).height = 20;

    // ── Satır 3: İl/İlçe/Mahalle ────────────────────────
    const il  = ttt.il_ad  || bbhb?.il  || cks?.il  || '';
    const ilce= ttt.ilce_ad|| bbhb?.ilce|| cks?.ilce || '';
    const koy = ttt.mahalle_ad || cks?.koy || '';
    ws.mergeCells(`A3:E3`); ws.getCell('A3').value = `İli: ${il}`;        s(ws.getCell('A3'), null, null, true, 'left');
    ws.mergeCells(`F3:K3`); ws.getCell('F3').value = `İlçesi: ${ilce}`;  s(ws.getCell('F3'), null, null, true, 'left');
    ws.mergeCells(`L3:${lastCol}3`); ws.getCell('L3').value = `Mahallesi: ${koy}`; s(ws.getCell('L3'), null, null, true, 'left');
    ws.getRow(3).height = 16;

    // ── Satır 4: Üst grup başlıkları ────────────────────
    // Sıra No (rowspan 4), Ad Soyad (rowspan 4)
    ws.mergeCells('A4:A7'); ws.getCell('A4').value = 'Sıra No'; s(ws.getCell('A4'), G1, WH, true);
    ws.mergeCells('B4:B7'); ws.getCell('B4').value = 'Adı Soyadı\nÇiftçi Ailesi'; s(ws.getCell('B4'), G1, WH, true);
    // Ek-4/a Ekiliş (colspan 3)
    ws.mergeCells('C4:E5'); ws.getCell('C4').value = '(Ek-4/a)\nÇİFTÇİ AİLE BİLDİRİM CETVELİ'; s(ws.getCell('C4'), G2, WH, true);
    // Ek-4/a Geçim (colspan 2)
    ws.mergeCells('F4:G5'); ws.getCell('F4').value = '(Ek-4/a)\nGEÇİM KAYNAĞI'; s(ws.getCell('F4'), G2, WH, true);
    // Ek-4/b Hayvan (colspan 11)
    ws.mergeCells(`H4:R4`); ws.getCell('H4').value = '(Ek-4/b)\nBÜYÜKBAŞ VE KÜÇÜKBAŞ HAYVAN VARLIĞI'; s(ws.getCell('H4'), G2, WH, true);
    // BBHB (rowspan 4)
    ws.mergeCells(`S4:S7`); ws.getCell('S4').value = 'BBHB'; s(ws.getCell('S4'), G1, WH, true);
    ws.getRow(4).height = 26;

    // ── Satır 5: Ekiliş alt başlıkları ──────────────────
    ws.mergeCells('C6:E6'); // (rowspan yapısı için C5:E6 kullanıyoruz)
    // Ekiliş başlıkları satır 6'da
    ws.getRow(5).height = 18;

    // ── Satır 6: Ekiliş detay + hayvan grupları ──────────
    ['C6','D6','E6'].forEach((c,i) => {
      ws.getCell(c).value = ['Yem Bitkisi (da)', 'Sebze-Bağ (da)', 'Hububat (da)'][i];
      s(ws.getCell(c), G2, WH, true);
    });
    ws.getCell('F6').value = 'Tarım'; s(ws.getCell('F6'), G2, WH, true);
    ws.getCell('G6').value = 'Hayvancılık'; s(ws.getCell('G6'), G2, WH, true);
    // Hayvan grup başlıkları
    let colOffset = 8; // H
    EK4B_GRUPLARI.forEach(g => {
      const c1 = String.fromCharCode(64 + colOffset);
      const c2 = String.fromCharCode(64 + colOffset + g.span - 1);
      if (g.span > 1) {
        try { ws.mergeCells(`${c1}6:${c2}6`); } catch(e){}
      }
      ws.getCell(`${c1}6`).value = g.ad;
      s(ws.getCell(`${c1}6`), G2, WH, true);
      colOffset += g.span;
    });
    ws.getRow(6).height = 18;

    // ── Satır 7: Hayvan cinsi başlıkları ────────────────
    EK4B_KOLONLAR.forEach((k, i) => {
      const c = String.fromCharCode(72 + i); // H'den başla
      ws.getCell(`${c}7`).value = k.kisa;
      s(ws.getCell(`${c}7`), G2, WH, true);
    });
    ws.getRow(7).height = 16;

    // ── Veri satırları ────────────────────────────────────
    const toplamSat = {
      yem: 0, sebze: 0, hububat: 0,
      ...Object.fromEntries(EK4B_KOLONLAR.map(k=>[k.key,0])),
      bbhb: 0,
    };

    isletmeciler.forEach((ist, idx) => {
      const rowNo = 8 + idx;
      const row = ws.getRow(rowNo);
      row.height = 17;
      const bgAlt = idx%2 ? 'FFF5FAF7' : null;

      // ÇKS eşleştirme (ad bazlı)
      const cksKisi = cksMap[ist.sahip?.toUpperCase().trim()] || null;

      const yem     = cksKisi?.yem_bitkisi || 0;
      const sebze   = cksKisi?.sebze_bag   || 0;
      const hububat = cksKisi?.hububat     || 0;

      // Sıra No, Ad Soyad
      row.getCell(1).value = idx + 1; s(row.getCell(1), bgAlt, null, false, 'center');
      row.getCell(2).value = ist.sahip || '–'; s(row.getCell(2), bgAlt, null, false, 'left');
      // Ekiliş
      row.getCell(3).value = yem   > 0 ? yem   : null; s(row.getCell(3), bgAlt, null, false, 'center');
      row.getCell(4).value = sebze > 0 ? sebze : null; s(row.getCell(4), bgAlt, null, false, 'center');
      row.getCell(5).value = hububat > 0 ? hububat : null; s(row.getCell(5), bgAlt, null, false, 'center');
      // Geçim kaynağı (X işareti)
      const hayvancilik = ist.toplam_bbhb > 0;
      const tarimci     = (yem+sebze+hububat) > 0;
      row.getCell(6).value = tarimci     ? 'X' : null; s(row.getCell(6), bgAlt, null, false, 'center');
      row.getCell(7).value = hayvancilik ? 'X' : null; s(row.getCell(7), bgAlt, null, false, 'center');

      // Hayvan varlığı
      const kd = ist.kategoriler || {};
      EK4B_KOLONLAR.forEach((kolon, ki) => {
        const colNo = 8 + ki;
        const adet  = kd[kolon.key]?.adet || kd[kolon.key] || 0;
        row.getCell(colNo).value = adet > 0 ? adet : null;
        s(row.getCell(colNo), bgAlt, null, false, 'center');
        if (adet) toplamSat[kolon.key] = (toplamSat[kolon.key]||0) + adet;
      });

      // BBHB
      const bbhbDeger = ist.toplam_bbhb || 0;
      row.getCell(19).value = bbhbDeger > 0 ? +bbhbDeger.toFixed(2) : null;
      row.getCell(19).numFmt = '#,##0.00';
      s(row.getCell(19), bgAlt, null, true, 'right');

      // Toplam birikimi
      toplamSat.yem    += yem;
      toplamSat.sebze  += sebze;
      toplamSat.hububat+= hububat;
      toplamSat.bbhb   += bbhbDeger;
    });

    // ── Toplam satırı ─────────────────────────────────────
    const totR = 8 + isletmeciler.length;
    const totRow = ws.getRow(totR); totRow.height = 20;
    ws.mergeCells(`A${totR}:B${totR}`);
    totRow.getCell(1).value = 'T O P L A M'; s(totRow.getCell(1), LG, null, true, 'center');
    totRow.getCell(3).value = toplamSat.yem    > 0 ? +toplamSat.yem.toFixed(3)    : null; s(totRow.getCell(3), LG, null, true, 'center');
    totRow.getCell(4).value = toplamSat.sebze  > 0 ? +toplamSat.sebze.toFixed(3)  : null; s(totRow.getCell(4), LG, null, true, 'center');
    totRow.getCell(5).value = toplamSat.hububat> 0 ? +toplamSat.hububat.toFixed(3): null; s(totRow.getCell(5), LG, null, true, 'center');
    totRow.getCell(6).value = null; s(totRow.getCell(6), LG);
    totRow.getCell(7).value = null; s(totRow.getCell(7), LG);
    EK4B_KOLONLAR.forEach((kolon, ki) => {
      const v = toplamSat[kolon.key] || 0;
      totRow.getCell(8+ki).value = v > 0 ? v : null;
      s(totRow.getCell(8+ki), LG, null, true, 'center');
    });
    totRow.getCell(19).value = +toplamSat.bbhb.toFixed(2); totRow.getCell(19).numFmt = '#,##0.00';
    s(totRow.getCell(19), LG, null, true, 'right');

    // ── Alt not: Üretim yılı ─────────────────────────────
    const notR = totR + 2;
    ws.mergeCells(`A${notR}:${lastCol}${notR}`);
    ws.getCell(`A${notR}`).value = `Not: Yukarıdaki çiftçi aile bildirimi ve ekiliş verileri ${uretimYili} yılı ÇKS (Çiftçi Kayıt Sistemi) kayıtlarından alınmıştır.`;
    ws.getCell(`A${notR}`).font = { italic: true, size: 9, color: { argb: 'FF666666' } };
    ws.getCell(`A${notR}`).alignment = { wrapText: true };
    ws.getRow(notR).height = 28;

    // ── Çıktı ─────────────────────────────────────────────
    const dosyaAd = `Ek-4ab_${il}_${koy}_${uretimYili}.xlsx`.replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(dosyaAd)}"`);
    await wb.xlsx.write(res); res.end();
  } catch (err) { next(err); }
};

module.exports = { ek4abExcel };
