/**
 * Ek-4/ab Raporu
 * TESTİT VE TAHDİT ÇALIŞMALARINA ESAS OLAN
 * ÇİFTÇİ AİLE, GEÇİM KAYNAĞI VE HAYVAN VARLIĞI BİLDİRİM CETVELİ
 */
const ExcelJS = require('exceljs');

const KOLONLAR = [
  { key:'Kültür İnek',             kisa:'İnek',        grup:'Kültür Irkı',    gs:2 },
  { key:'Kültür Dana-Düve',        kisa:'Dana-Düve',   grup:'Kültür Irkı',    gs:0 },
  { key:'Kültür Melezi İnek',      kisa:'İnek',        grup:'Kültür Melezi',  gs:2 },
  { key:'Kültür Melezi Dana-Düve', kisa:'Dana-Düve',   grup:'Kültür Melezi',  gs:0 },
  { key:'Yerli İnek',              kisa:'İnek',        grup:'Yerli Irk',      gs:2 },
  { key:'Yerli Dana-Düve',         kisa:'Dana-Düve',   grup:'Yerli Irk',      gs:0 },
  { key:'Boğa',                    kisa:'Boğa',        grup:'Büyükbaş Diğer', gs:2 },
  { key:'Öküz',                    kisa:'Öküz',        grup:'Büyükbaş Diğer', gs:0 },
  { key:'Manda Erkek',             kisa:'Erkek',       grup:'Manda',          gs:2 },
  { key:'Manda Dişi',              kisa:'Dişi',        grup:'Manda',          gs:0 },
  { key:'Koyun',                   kisa:'Koyun',       grup:'Küçükbaş',       gs:3 },
  { key:'Keçi',                    kisa:'Keçi',        grup:'Küçükbaş',       gs:0 },
  { key:'Kuzu/Oğlak',             kisa:'Kuzu/Oğlak',  grup:'Küçükbaş',       gs:0 },
  { key:'At',                      kisa:'At',          grup:'Tek Tırnaklı',   gs:3 },
  { key:'Katır',                   kisa:'Katır',       grup:'Tek Tırnaklı',   gs:0 },
  { key:'Eşek',                    kisa:'Eşek',        grup:'Tek Tırnaklı',   gs:0 },
];

const KAT = {
  'Kültür İnek':'Kültür İnek','Kültür Dana-Düve':'Kültür Dana-Düve',
  'Kültür Melezi İnek':'Kültür Melezi İnek','Kültür Melezi Dana-Düve':'Kültür Melezi Dana-Düve',
  'Yerli İnek':'Yerli İnek','Yerli Dana-Düve':'Yerli Dana-Düve',
  'Boğa':'Boğa','Öküz':'Öküz','Manda Erkek':'Manda Erkek','Manda Dişi':'Manda Dişi',
  'Koyun':'Koyun','Keçi':'Keçi','Kuzu/Oğlak':'Kuzu/Oğlak',
  'At':'At','Katır':'Katır','Eşek':'Eşek',
  'Kültür ırkı süt ineği':'Kültür İnek','Dana-düve (kültür ırkı)':'Kültür Dana-Düve',
  'Kültür melezi':'Kültür Melezi İnek','Dana-düve (kültür melezi)':'Kültür Melezi Dana-Düve',
  'Yerli inek':'Yerli İnek','Dana-düve (yerli)':'Yerli Dana-Düve',
  'Manda (erkek)':'Manda Erkek','Manda (dişi)':'Manda Dişi','Kuzu-oğlak':'Kuzu/Oğlak',
};

// Kurum sıralama
const KURUM_SIRA = [
  'il tarım','il müdürlüğü','tarım ve orman müdürlüğü',
  'ilçe tarım','ilçe müdürlüğü',
  'belediye',
  'kadastro',
  'milli emlak','millî emlak',
  'orman',
  'muhtar','muhtarlık',
  'bilirkişi','aza',
];
const kurumSira = (k='') => {
  const i = KURUM_SIRA.findIndex(s => k.toLowerCase().includes(s));
  return i === -1 ? 99 : i;
};

// Kurum tam adı
const kurumTamAd = (kurum, birim) => {
  if (!kurum) return '';
  if (!birim) return kurum;
  if (kurum === 'Belediye') return `${birim} Belediye Başkanlığı`;
  if (kurum === 'Mahalle Muhtarlığı' || kurum === 'Muhtarlık') return `${birim} Muhtarlığı`;
  if (kurum === 'Mahalli Bilirkişi') return `${birim} Mahallesi Bilirkişisi`;
  return `${birim} ${kurum}`;
};

const col = n => n <= 26
  ? String.fromCharCode(64 + n)
  : String.fromCharCode(64 + Math.floor((n-1)/26)) + String.fromCharCode(65 + (n-1)%26);

const N  = KOLONLAR.length; // 16
const NT = 8 + N + 1;       // 25 sütun (A..Y)

const ek4abExcel = async (req, res, next) => {
  try {
    const Tahsis    = require('../tahsis/tahsis.model');
    const BBHBHesap = require('../bbhb/bbhb.model');
    const CksYukle  = require('../cks/cks.model');
    const Ayarlar   = require('../ayarlar/ayarlar.model');

    const ttt = await Tahsis.findById(req.params.id);
    if (!ttt) return res.status(404).json({success:false, message:'Kayıt bulunamadı'});

    const {bbhb_id, cks_id} = req.body;
    const [bbhb, cks, ayarlar] = await Promise.all([
      bbhb_id ? BBHBHesap.findById(bbhb_id) : null,
      cks_id  ? CksYukle.findById(cks_id)   : null,
      Ayarlar.findOne().select('teknik_ekipler'),
    ]);

    // İşletmeciler
    const isletmeciler = bbhb
      ? (bbhb.isletmeciler?.length
          ? bbhb.isletmeciler
          : [{
              sahip: bbhb.ciftci_ad||'–',
              kategoriler: Object.fromEntries(
                (bbhb.hayvanlar||[]).filter(h=>h.adet>0).map(h=>[h.tur_adi,{adet:h.adet}])
              ),
              toplam_bbhb: bbhb.toplam_bbhb
            }])
      : [];

    // ÇKS haritası
    const cksMap = {};
    if (cks?.kisiler) cks.kisiler.forEach(k => {
      cksMap[k.ad_soyad.toUpperCase().trim()] = k;
    });
    const yil = cks?.uretim_yili || new Date().getFullYear();

    // Teknik ekip — ilçe bazlı, kuruma göre sıralı
    const ilce = ttt.ilce_ad || '';
    let teknikEkip = [];
    if (ayarlar?.teknik_ekipler?.length) {
      const ekip = ayarlar.teknik_ekipler.find(e =>
        e.uyeler?.some(u => (u.kurum||'').includes(ilce))
      ) || ayarlar.teknik_ekipler[ayarlar.teknik_ekipler.length-1];
      teknikEkip = [...(ekip?.uyeler||[])]
        .sort((a,b) => kurumSira(a.kurum) - kurumSira(b.kurum));
    }
    const ormanVar = teknikEkip.some(u => (u.kurum||'').toLowerCase().includes('orman'));

    // Excel oluştur
    const wb = new ExcelJS.Workbook(); wb.creator = 'MİS';
    const ws = wb.addWorksheet('Ek-4ab');

    // ── Sabitler ─────────────────────────────────────────
    const FONT = 'Times New Roman';
    const GRI  = 'FF777777'; // TEK gri ton — başlık arka plan
    const WH   = 'FFFFFFFF';
    const LG   = 'FFE0E0E0'; // Açık gri — toplam
    const KOYU = 'FF111111';
    const ROW_H = 14.5;

    // Sütun genişlikleri
    ws.columns = [
      {width:5},  // A Sıra
      {width:28}, // B Ad Soyad
      {width:9},  // C Yem
      {width:9},  // D Sebze
      {width:9},  // E Hububat
      {width:7},  // F Tarım
      {width:8},  // G Hayvancılık
      {width:9},  // H Toplam Hayvan
      ...KOLONLAR.map(()=>({width:7})), // I..X 16 hayvan
      {width:9},  // Y BBHB
    ];

    const sty = (cell, bg, color, bold, align) => {
      if (bg) cell.fill = {type:'pattern', pattern:'solid', fgColor:{argb:bg}};
      cell.font = {name:FONT, bold:!!bold, color:{argb:color||KOYU}, size:8};
      cell.alignment = {horizontal:align||'center', vertical:'middle', wrapText:true};
      const b = {style:'thin', color:{argb:'FFAAAAAA'}};
      cell.border = {top:b, bottom:b, left:b, right:b};
    };

    const mc = (r1, c1, r2, c2) => {
      const a = `${col(c1)}${r1}`, b = `${col(c2)}${r2}`;
      if (a !== b) try { ws.mergeCells(`${a}:${b}`); } catch(e) {}
      return ws.getCell(a);
    };

    const il  = ttt.il_ad  || bbhb?.il  || cks?.il  || '';
    const koy = ttt.mahalle_ad || cks?.koy || '';

    // ── SATIR 1: Ana başlık ───────────────────────────────
    const s1 = mc(1,1,1,NT);
    s1.value = 'TESTİT VE TAHDİT ÇALIŞMALARINA ESAS OLAN ÇİFTÇİ AİLE, GEÇİM KAYNAĞI VE HAYVAN VARLIĞI BİLDİRİM CETVELİ';
    s1.fill = {type:'pattern', pattern:'solid', fgColor:{argb:GRI}};
    s1.font = {name:FONT, bold:true, color:{argb:WH}, size:10};
    s1.alignment = {horizontal:'center', vertical:'middle', wrapText:true};
    ws.getRow(1).height = 28;

    // ── SATIR 2: Yer ─────────────────────────────────────
    mc(2,1,2,7);   ws.getCell('A2').value = `İli: ${il}`;         sty(ws.getCell('A2'),null,null,true,'left');
    mc(2,8,2,16);  ws.getCell('H2').value = `İlçesi: ${ilce}`;    sty(ws.getCell('H2'),null,null,true,'left');
    mc(2,17,2,NT); ws.getCell(col(17)+'2').value = `Mahallesi/Köyü: ${koy}`; sty(ws.getCell(col(17)+'2'),null,null,true,'left');
    ws.getRow(2).height = ROW_H;

    // ── SATIRLAR 3-6: Başlık tablosu ─────────────────────
    // A,B rowspan 4
    mc(3,1,6,1); ws.getCell('A3').value = 'Sıra\nNo';               sty(ws.getCell('A3'),GRI,WH,true);
    mc(3,2,6,2); ws.getCell('B3').value = 'Adı Soyadı\n(Çiftçi Ailesi)'; sty(ws.getCell('B3'),GRI,WH,true);

    // Üst grup (satır 3-4)
    mc(3,3,4,5);   ws.getCell('C3').value = '(Ek-4/a)\nÇİFTÇİ AİLE BİLDİRİM CETVELİ'; sty(ws.getCell('C3'),GRI,WH,true);
    mc(3,6,4,8);   ws.getCell('F3').value = '(Ek-4/a)\nGEÇİM KAYNAĞI';                  sty(ws.getCell('F3'),GRI,WH,true);
    mc(3,9,4,8+N); ws.getCell('I3').value = '(Ek-4/b)\nBÜYÜKBAŞ VE KÜÇÜKBAŞ HAYVAN VARLIĞI'; sty(ws.getCell('I3'),GRI,WH,true);
    mc(3,NT,6,NT); ws.getCell(col(NT)+'3').value = 'Toplam\nBBHB'; sty(ws.getCell(col(NT)+'3'),GRI,WH,true);
    ws.getRow(3).height = 22;
    ws.getRow(4).height = 6;

    // Alt grup (satır 5-6)
    mc(5,3,6,3); ws.getCell('C5').value = 'Yem Bitkisi\n(da)';         sty(ws.getCell('C5'),GRI,WH,true);
    mc(5,4,6,4); ws.getCell('D5').value = 'Sebze-Bağ\n(da)';           sty(ws.getCell('D5'),GRI,WH,true);
    mc(5,5,6,5); ws.getCell('E5').value = 'Hububat\n(da)';             sty(ws.getCell('E5'),GRI,WH,true);
    mc(5,6,6,6); ws.getCell('F5').value = 'Tarım\n(X)';                sty(ws.getCell('F5'),GRI,WH,true);
    mc(5,7,6,7); ws.getCell('G5').value = 'Hayvancılık\n(X)';          sty(ws.getCell('G5'),GRI,WH,true);
    mc(5,8,6,8); ws.getCell('H5').value = 'Toplam\nHayvan\nVarlığı\n(adet)'; sty(ws.getCell('H5'),GRI,WH,true);
    ws.getRow(5).height = 32;

    // Hayvan grup başlıkları (satır 5)
    let hc = 9;
    KOLONLAR.forEach(k => {
      if (k.gs > 0) {
        const c = mc(5,hc,5,hc+k.gs-1); c.value = k.grup; sty(c,GRI,WH,true);
      }
      hc++;
    });

    // Hayvan cinsi (satır 6)
    KOLONLAR.forEach((k,i) => {
      const c = ws.getRow(6).getCell(9+i); c.value = k.kisa; sty(c,GRI,WH,true);
    });
    ws.getRow(6).height = ROW_H;

    // ── VERİ SATIRLARI ────────────────────────────────────
    const tot = {yem:0, sebze:0, hub:0, hayvan:0, bbhb:0};
    const hTot = {}; KOLONLAR.forEach(k => { hTot[k.key] = 0; });

    isletmeciler.forEach((ist, idx) => {
      const rn  = 7 + idx;
      const row = ws.getRow(rn);
      row.height = ROW_H;
      const bg = null; // Renk yok — tek ton istendi

      const ck     = cksMap[ist.sahip?.toUpperCase().trim()] || null;
      const yem    = ck?.yem_bitkisi || 0;
      const sebze  = ck?.sebze_bag   || 0;
      const hub    = ck?.hububat     || 0;

      row.getCell(1).value = idx+1;           sty(row.getCell(1),bg,null,false,'center');
      row.getCell(2).value = ist.sahip||'–';  sty(row.getCell(2),bg,null,false,'left');
      row.getCell(3).value = yem>0?yem:null;  sty(row.getCell(3),bg,null,false,'center');
      row.getCell(4).value = sebze>0?sebze:null; sty(row.getCell(4),bg,null,false,'center');
      row.getCell(5).value = hub>0?hub:null;  sty(row.getCell(5),bg,null,false,'center');
      row.getCell(6).value = (yem+sebze+hub)>0?'X':null; sty(row.getCell(6),bg,null,false,'center');
      row.getCell(7).value = (ist.toplam_bbhb||0)>0?'X':null; sty(row.getCell(7),bg,null,false,'center');

      // Hayvan verileri
      const kd = ist.kategoriler || {};
      let tH = 0;
      KOLONLAR.forEach((kolon, ki) => {
        let adet = 0;
        const v = kd[kolon.key];
        if (v != null) adet = v?.adet ?? v;
        if (!adet) {
          for (const [eski, yeni] of Object.entries(KAT)) {
            if (yeni === kolon.key && kd[eski] != null) {
              adet = kd[eski]?.adet ?? kd[eski]; break;
            }
          }
        }
        const n = parseInt(adet) || 0;
        row.getCell(9+ki).value = n>0?n:null; sty(row.getCell(9+ki),bg,null,false,'center');
        if (n) { hTot[kolon.key] += n; tH += n; }
      });

      row.getCell(8).value = tH>0?tH:null; sty(row.getCell(8),bg,null,true,'center');

      const bv = ist.toplam_bbhb || 0;
      row.getCell(NT).value = bv>0?+bv.toFixed(2):null;
      row.getCell(NT).numFmt = '#,##0.00';
      sty(row.getCell(NT),bg,null,true,'right');

      tot.yem += yem; tot.sebze += sebze; tot.hub += hub;
      tot.hayvan += tH; tot.bbhb += bv;
    });

    // ── TOPLAM SATIRI ─────────────────────────────────────
    const tr   = 7 + isletmeciler.length;
    const tRow = ws.getRow(tr); tRow.height = ROW_H;
    mc(tr,1,tr,2); ws.getCell(`A${tr}`).value = 'T O P L A M'; sty(ws.getCell(`A${tr}`),LG,null,true,'center');
    ws.getCell(`C${tr}`).value = tot.yem>0?+tot.yem.toFixed(3):null;   sty(ws.getCell(`C${tr}`),LG,null,true,'center');
    ws.getCell(`D${tr}`).value = tot.sebze>0?+tot.sebze.toFixed(3):null; sty(ws.getCell(`D${tr}`),LG,null,true,'center');
    ws.getCell(`E${tr}`).value = tot.hub>0?+tot.hub.toFixed(3):null;   sty(ws.getCell(`E${tr}`),LG,null,true,'center');
    ws.getCell(`F${tr}`).value = null; sty(ws.getCell(`F${tr}`),LG);
    ws.getCell(`G${tr}`).value = null; sty(ws.getCell(`G${tr}`),LG);
    ws.getCell(`H${tr}`).value = tot.hayvan||null; sty(ws.getCell(`H${tr}`),LG,null,true,'center');
    KOLONLAR.forEach((k,ki) => {
      const v = hTot[k.key] || 0;
      ws.getCell(`${col(9+ki)}${tr}`).value = v>0?v:null;
      sty(ws.getCell(`${col(9+ki)}${tr}`),LG,null,true,'center');
    });
    ws.getCell(`${col(NT)}${tr}`).value = +tot.bbhb.toFixed(2);
    ws.getCell(`${col(NT)}${tr}`).numFmt = '#,##0.00';
    sty(ws.getCell(`${col(NT)}${tr}`),LG,null,true,'right');

    // ── NOTLAR ────────────────────────────────────────────
    let nr = tr + 1;
    mc(nr,1,nr,NT);
    ws.getCell(`A${nr}`).value = `Not: Yukarıdaki hayvan sayıları ve ekiliş alanı verileri ${yil} yılı ÇKS (Çiftçi Kayıt Sistemi) ve Türkvet kayıtlarından alınmıştır.`;
    ws.getCell(`A${nr}`).font = {name:FONT, italic:true, size:8, color:{argb:GRI}};
    ws.getCell(`A${nr}`).alignment = {wrapText:true};
    ws.getRow(nr).height = 20;

    if (!ormanVar && teknikEkip.length > 0) {
      nr++;
      mc(nr,1,nr,NT);
      ws.getCell(`A${nr}`).value = 'Not: Orman içi, orman kenarı ve orman üst sınırı mera bulunmadığı, orman köyü olmadığı için Orman Mühendisi teknik çalışmalara katılmamıştır.';
      ws.getCell(`A${nr}`).font = {name:FONT, italic:true, size:8, color:{argb:GRI}};
      ws.getCell(`A${nr}`).alignment = {wrapText:true};
      ws.getRow(nr).height = 20;
    }

    // ── TEKNİK EKİP İMZALARI ─────────────────────────────
    // Üst satır 4, alt satır 5, soldan sağa sıralı
    if (teknikEkip.length > 0) {
      const satirlar = [];
      if (teknikEkip.length <= 4) {
        satirlar.push(teknikEkip);
      } else {
        satirlar.push(teknikEkip.slice(0,4));
        satirlar.push(teknikEkip.slice(4,9));
        if (teknikEkip.length > 9) satirlar.push(teknikEkip.slice(9));
      }

      let iR = nr + 2;
      satirlar.forEach(sat => {
        const adet = sat.length;
        const bw   = Math.floor(NT / adet);

        sat.forEach((u, i) => {
          // Soldan sağa — i sırasına göre
          const c1 = 1 + i * bw;
          const c2 = i < adet-1 ? c1 + bw - 1 : NT;

          // Ad Soyad
          const adC = mc(iR, c1, iR, c2);
          adC.value = u.ad_soyad || u.ad || '';
          adC.font  = {name:FONT, bold:true, size:8, color:{argb:KOYU}};
          adC.alignment = {horizontal:'center', wrapText:true};

          // Ünvan
          const unC = mc(iR+1, c1, iR+1, c2);
          unC.value = u.unvan || '';
          unC.font  = {name:FONT, size:8, color:{argb:GRI}};
          unC.alignment = {horizontal:'center', wrapText:true};

          // Kurum tam adı
          const kurC = mc(iR+2, c1, iR+2, c2);
          kurC.value = kurumTamAd(u.kurum||'', u.birim||'');
          kurC.font  = {name:FONT, size:8, color:{argb:GRI}};
          kurC.alignment = {horizontal:'center', wrapText:true};

          // İmza çizgisi (3 boş satır sonra)
          const imC = mc(iR+5, c1, iR+5, c2);
          imC.value = '';
          imC.border = {bottom:{style:'medium', color:{argb:'FF000000'}}};
        });

        ws.getRow(iR).height   = 14.5; // Ad
        ws.getRow(iR+1).height = 14.5; // Ünvan
        ws.getRow(iR+2).height = 18;   // Kurum (sarabilir)
        ws.getRow(iR+5).height = 28;   // İmza
        iR += 7;
      });

      // Tarih
      mc(iR,1,iR,NT);
      ws.getCell(`A${iR}`).value = '........./........./20.......';
      ws.getCell(`A${iR}`).alignment = {horizontal:'right'};
      ws.getCell(`A${iR}`).font = {name:FONT, size:8};
      ws.getRow(iR).height = 16;
    }

    const dosyaAd = `Ek-4ab_${il}_${koy}_${yil}.xlsx`.replace(/\s+/g,'_');
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${encodeURIComponent(dosyaAd)}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch(err) { next(err); }
};

module.exports = { ek4abExcel };
