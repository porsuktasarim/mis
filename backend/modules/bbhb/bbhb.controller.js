const BBHBHesaplama = require('./bbhb.model');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } = require('docx');

// ── Hayvan türleri ve BBHB katsayıları ────────────────────
const HAYVAN_TURLERI = [
  { tur_id: 'kult_sut',   tur_adi: 'Kültür İnek',          katsayi: 1.00, grup: 'Kültür Irkı' },
  { tur_id: 'dana_kult',  tur_adi: 'Kültür Dana-Düve',     katsayi: 0.60, grup: 'Kültür Irkı' },
  { tur_id: 'kult_mez',   tur_adi: 'Kültür Melezi İnek',   katsayi: 0.75, grup: 'Kültür Melezi' },
  { tur_id: 'dana_mez',   tur_adi: 'Kültür Melezi Dana-Düve', katsayi: 0.45, grup: 'Kültür Melezi' },
  { tur_id: 'yerli_inek', tur_adi: 'Yerli İnek',           katsayi: 0.50, grup: 'Yerli Irk' },
  { tur_id: 'dana_yerli', tur_adi: 'Yerli Dana-Düve',      katsayi: 0.30, grup: 'Yerli Irk' },
  { tur_id: 'boga',       tur_adi: 'Boğa',                 katsayi: 1.50, grup: 'Büyükbaş Diğer' },
  { tur_id: 'okuz',       tur_adi: 'Öküz',                 katsayi: 0.60, grup: 'Büyükbaş Diğer' },
  { tur_id: 'manda_e',    tur_adi: 'Manda Erkek',          katsayi: 0.90, grup: 'Manda' },
  { tur_id: 'manda_d',    tur_adi: 'Manda Dişi',           katsayi: 0.75, grup: 'Manda' },
  { tur_id: 'koyun',      tur_adi: 'Koyun',                katsayi: 0.10, grup: 'Küçükbaş' },
  { tur_id: 'keci',       tur_adi: 'Keçi',                 katsayi: 0.08, grup: 'Küçükbaş' },
  { tur_id: 'kuzu',       tur_adi: 'Kuzu/Oğlak',           katsayi: 0.04, grup: 'Küçükbaş' },
  { tur_id: 'at',         tur_adi: 'At',                   katsayi: 0.50, grup: 'Tek Tırnaklı' },
  { tur_id: 'katir',      tur_adi: 'Katır',                katsayi: 0.40, grup: 'Tek Tırnaklı' },
  { tur_id: 'esek',       tur_adi: 'Eşek',                 katsayi: 0.30, grup: 'Tek Tırnaklı' },
];

// Rapor tablosundaki sütun sırası — her zaman tüm sütunlar gösterilir
// Format: { kolon: 'tablo_sutun_adi', kısa: 'başlık', katsayi: 0.xx, grup: 'Üst Grup' }
const TABLO_SUTUNLARI = [
  { kolon: 'Kültür İnek',              kisa: 'İnek',       katsayi: 1.00, grup: 'Kültür Irkı' },
  { kolon: 'Kültür Dana-Düve',         kisa: 'Dana-Düve',  katsayi: 0.60, grup: 'Kültür Irkı' },
  { kolon: 'Kültür Melezi İnek',       kisa: 'İnek',       katsayi: 0.75, grup: 'Kültür Melezi' },
  { kolon: 'Kültür Melezi Dana-Düve',  kisa: 'Dana-Düve',  katsayi: 0.45, grup: 'Kültür Melezi' },
  { kolon: 'Yerli İnek',               kisa: 'İnek',       katsayi: 0.50, grup: 'Yerli Irk' },
  { kolon: 'Yerli Dana-Düve',          kisa: 'Dana-Düve',  katsayi: 0.30, grup: 'Yerli Irk' },
  { kolon: 'Boğa',                     kisa: 'Boğa',       katsayi: 1.50, grup: 'Büyükbaş Diğer' },
  { kolon: 'Öküz',                     kisa: 'Öküz',       katsayi: 0.60, grup: 'Büyükbaş Diğer' },
  { kolon: 'Manda Erkek',              kisa: 'Erkek',      katsayi: 0.90, grup: 'Manda' },
  { kolon: 'Manda Dişi',               kisa: 'Dişi',       katsayi: 0.75, grup: 'Manda' },
  { kolon: 'Koyun',                    kisa: 'Koyun',      katsayi: 0.10, grup: 'Küçükbaş' },
  { kolon: 'Keçi',                     kisa: 'Keçi',       katsayi: 0.08, grup: 'Küçükbaş' },
  { kolon: 'Kuzu/Oğlak',              kisa: 'Kuzu/Oğlak', katsayi: 0.04, grup: 'Küçükbaş' },
  { kolon: 'At',                       kisa: 'At',         katsayi: 0.50, grup: 'Tek Tırnaklı' },
  { kolon: 'Katır',                    kisa: 'Katır',      katsayi: 0.40, grup: 'Tek Tırnaklı' },
  { kolon: 'Eşek',                     kisa: 'Eşek',       katsayi: 0.30, grup: 'Tek Tırnaklı' },
];

// Üst grup birleştirmeleri (colspan hesabı için)
const TABLO_GRUPLARI = [
  { ad: 'Kültür Irkı',        span: 2 },
  { ad: 'Kültür Melezi',      span: 2 },
  { ad: 'Yerli Irk',          span: 2 },
  { ad: 'Büyükbaş Diğer',     span: 2 },
  { ad: 'Manda',              span: 2 },
  { ad: 'Küçükbaş',           span: 3 },
  { ad: 'Tek Tırnaklı',       span: 3 },
];

// Tür adı → kolon adı eşleşmesi (hem eski hem yeni tur_adi değerlerini destekle)
const KAT_KOLON = {
  // Yeni adlar
  'Kültür İnek':               'Kültür İnek',
  'Kültür Dana-Düve':          'Kültür Dana-Düve',
  'Kültür Melezi İnek':        'Kültür Melezi İnek',
  'Kültür Melezi Dana-Düve':   'Kültür Melezi Dana-Düve',
  'Yerli İnek':                'Yerli İnek',
  'Yerli Dana-Düve':           'Yerli Dana-Düve',
  'Boğa':                      'Boğa',
  'Öküz':                      'Öküz',
  'Manda Erkek':               'Manda Erkek',
  'Manda Dişi':                'Manda Dişi',
  'Koyun':                     'Koyun',
  'Keçi':                      'Keçi',
  'Kuzu/Oğlak':               'Kuzu/Oğlak',
  'At':                        'At',
  'Katır':                     'Katır',
  'Eşek':                      'Eşek',
  // Eski adlar (geriye dönük uyumluluk)
  'Kültür ırkı süt ineği':     'Kültür İnek',
  'Kültür melezi':             'Kültür Melezi İnek',
  'Yerli inek':                'Yerli İnek',
  'Dana-düve (kültür ırkı)':  'Kültür Dana-Düve',
  'Dana-düve (kültür melezi)': 'Kültür Melezi Dana-Düve',
  'Dana-düve (yerli)':         'Yerli Dana-Düve',
  'Manda (erkek)':             'Manda Erkek',
  'Manda (dişi)':              'Manda Dişi',
  'Kuzu-oğlak':                'Kuzu/Oğlak',
  'Kuzu-Oğlak':                'Kuzu/Oğlak',
};

// Tür adı → sütun numarası (Excel için, sütun 3'ten başlar)
const KAT_COL_NUM = Object.fromEntries(
  TABLO_SUTUNLARI.map((s, i) => [s.kolon, i + 3])
);
// Eski adlardan da erişim
Object.entries(KAT_KOLON).forEach(([eski, yeni]) => {
  if (KAT_COL_NUM[yeni] !== undefined) KAT_COL_NUM[eski] = KAT_COL_NUM[yeni];
});

const KOLONLAR     = TABLO_SUTUNLARI.map(s => s.kolon);
const KOLONLAR_KISA = TABLO_SUTUNLARI.map(s => s.kisa);
const KOLON_KATSAYI = Object.fromEntries(TABLO_SUTUNLARI.map(s => [s.kolon, s.katsayi]));

// Yer başlığı → "İstanbul İli Silivri İlçesi Akören Köyü/Mahallesi"
const yerOlustur = (il, ilce, mahalle) => [
  il      ? il      + ' İli'          : '',
  ilce    ? ilce    + ' İlçesi'       : '',
  mahalle ? mahalle + ' Köyü/Mahallesi' : '',
].filter(Boolean).join(' ');

// ── Mera alan hesabı (4 vasıf düzeyi ayrı ayrı) ───────────
const meraHesapla = async (toplam_bbhb, il) => {
  const gunlukYem    = 50;    // kg / BBHB / gün
  const otlatmaSuresi = 180;  // gün
  const toplamYemKg  = toplam_bbhb * gunlukYem * otlatmaSuresi;
  const fmt = n => Number(n.toFixed(1)).toLocaleString('tr-TR', { minimumFractionDigits: 1 });

  const Ayarlar = require('../ayarlar/ayarlar.model');
  const ayarlar = await Ayarlar.findOne().select('yagis_kusaklari yararlanilabilir_yesil_ot');

  // İle özgü yağış kuşağı satırını bul
  let verimSatir = null;
  let kusak = null;
  if (il && ayarlar?.yagis_kusaklari?.length) {
    const ilKusagi = ayarlar.yagis_kusaklari.find(
      k => k.il_ad && k.il_ad.toLowerCase().trim() === il.toLowerCase().trim()
    );
    if (ilKusagi && ayarlar?.yararlanilabilir_yesil_ot?.length) {
      verimSatir = ayarlar.yararlanilabilir_yesil_ot.find(v => v.kusak === ilKusagi.kusak);
      kusak = ilKusagi.kusak;
    }
  }

  // Verim bulunamazsa tüm kuşakların ortalamasını kullan
  if (!verimSatir && ayarlar?.yararlanilabilir_yesil_ot?.length) {
    const satirlar = ayarlar.yararlanilabilir_yesil_ot;
    const ort = field => {
      const vals = satirlar.map(s => s[field]).filter(v => v > 0);
      return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null;
    };
    verimSatir = { cok_iyi: ort('cok_iyi'), iyi: ort('iyi'), orta: ort('orta'), zayif: ort('zayif') };
    kusak = null; // Genel ortalama
  }

  const hesapla = v => v && v > 0 ? toplamYemKg / v : null;
  return {
    gun: otlatmaSuresi,
    gunlukYem,
    toplamYemKg,
    il, kusak,
    cok_iyi: hesapla(verimSatir?.cok_iyi),
    iyi:     hesapla(verimSatir?.iyi),
    orta:    hesapla(verimSatir?.orta),
    zayif:   hesapla(verimSatir?.zayif),
    verim:   verimSatir || {},
    fmt,
  };
};

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


// ── Ortak sabitler ─────────────────────────────────────────
// (KOLONLAR, KOLONLAR_KISA, KAT_KOLON, KAT_COL_NUM yukarıda tanımlı)

// İşletmeci listesi normalize et
const isletmecileriGetir = (kayit) =>
  Array.isArray(kayit.isletmeciler) && kayit.isletmeciler.length > 0
    ? kayit.isletmeciler
    : [{ sahip: kayit.ciftci_ad||'-',
         kategoriler: Object.fromEntries(kayit.hayvanlar.filter(h=>h.adet>0).map(h=>[h.tur_adi,{adet:h.adet,bbhb:h.bbhb}])),
         toplam_adet: kayit.toplam_adet, toplam_bbhb: kayit.toplam_bbhb }];

// Kategori → kolon eşleştir (her zaman KAT_KOLON üzerinden)
const katToKolon = (kategoriler) => {
  const kd = {};
  Object.entries(kategoriler||{}).forEach(([kat,v]) => {
    const k = KAT_KOLON[kat]; if (k) kd[k] = (kd[k]||0) + (v.adet||0);
  });
  return kd;
};

// ── EXCEL RAPOR ────────────────────────────────────────────
const excelRapor = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success:false, message:'Kayıt bulunamadı' });
    const mera = await meraHesapla(kayit.toplam_bbhb, kayit.il);
    const isletmeciler = isletmecileriGetir(kayit);
    const N = KOLONLAR.length; // 16
    const SON = N + 3; // son sütun harfi (C=3, C+16=19=S)

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MİS - Mera İzleme Sistemi';
    const ws = wb.addWorksheet('BBHB');

    const G1='FF0F6E56', G2='FF1D9E75', WH='FFFFFFFF', LG='FFE1F5EE', MG='FFC8EAD8', YL='FFFFF8E1', LB='FFE8F4FD';

    // Sütun genişlikleri: A=sıra, B=isim, C..R=hayvanlar(8px), S=toplam
    ws.columns = [
      {width:5}, {width:30},
      ...KOLONLAR.map(()=>({width:8})),
      {width:11},
    ];

    const s = (cell, bg, color, bold, align, border) => {
      if (bg) cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:bg}};
      cell.font = {bold:!!bold, color:{argb:color||'FF000000'}, size:9};
      cell.alignment = {horizontal:align||'center',vertical:'middle',wrapText:true};
      if (border) { const b={style:'thin',color:{argb:'FFCCCCCC'}}; cell.border={top:b,bottom:b,left:b,right:b}; }
    };

    const lastCol = String.fromCharCode(66 + N + 1); // B+N+1 = son sütun

    // Satır 1: Yer başlığı — il/ilçe/mahalle
    const yerBaslik = yerOlustur(kayit.il, kayit.ilce, kayit.mahalle) || 'BBHB RAPORU';
    ws.mergeCells(`A1:${lastCol}1`);
    ws.getCell('A1').value = yerBaslik;
    s(ws.getCell('A1'),G1,WH,true,'center'); ws.getRow(1).height=22;

    // Satır 2: Başlık
    ws.mergeCells(`A2:${lastCol}2`);
    ws.getCell('A2').value = 'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU';
    s(ws.getCell('A2'),G1,WH,true,'center'); ws.getRow(2).height=22;

    // Satır 3: Tarih
    ws.mergeCells('A3:G3');
    ws.getCell('A3').value = 'Tarih: '+new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    s(ws.getCell('A3'),null,null,false,'left'); ws.getRow(3).height=15;

    // ── BAŞLIK SATIRLARI 4-6 ─────────────────────────────
    // A=Sıra(4-6), B=İsim(4-6), Son=BBHB(4-6) — rowspan 3
    // C..Son-1 = Satır 4: Grup adları, Satır 5: Hayvan kısa ad, Satır 6: Katsayı

    // A ve B hücresi — 3 satır birleşik (4-6)
    ws.mergeCells(`A4:A6`);
    ws.getCell('A4').value = 'Sıra\nNo';
    s(ws.getCell('A4'),G1,WH,true);

    ws.mergeCells(`B4:B6`);
    ws.getCell('B4').value = 'İkamet Eden Aile Temsilcisinin\nAdı Soyadı (Aile)';
    s(ws.getCell('B4'),G1,WH,true);

    // BBHB — 3 satır birleşik (4-6)
    ws.mergeCells(`${lastCol}4:${lastCol}6`);
    ws.getCell(`${lastCol}4`).value = 'Toplam\nBBHB';
    s(ws.getCell(`${lastCol}4`),G2,WH,true);

    // Satır 4: Hayvan grup başlıkları (C..Son-1)
    let colIdx = 3;
    TABLO_GRUPLARI.forEach(g => {
      const c1 = colIdx, c2 = colIdx + g.span - 1;
      const l1 = String.fromCharCode(64+c1), l2 = String.fromCharCode(64+c2);
      if (c1 === c2) {
        ws.getCell(`${l1}4`).value = g.ad; s(ws.getCell(`${l1}4`),G2,WH,true);
      } else {
        try { ws.mergeCells(`${l1}4:${l2}4`); } catch(e){}
        ws.getCell(`${l1}4`).value = g.ad; s(ws.getCell(`${l1}4`),G2,WH,true);
      }
      colIdx += g.span;
    });
    ws.getRow(4).height = 22;

    // Satır 5: Kısa hayvan adları
    KOLONLAR_KISA.forEach((v,i) => {
      const c = ws.getRow(5).getCell(i+3); c.value=v; s(c,G2,WH,true);
    });
    ws.getRow(5).height = 18;

    // Satır 6: BBHB Katsayıları
    KOLONLAR.forEach((k,i) => {
      const c = ws.getRow(6).getCell(i+3); c.value=KOLON_KATSAYI[k]; c.numFmt='0.00'; s(c,YL,'FF6D4C00',true);
    });
    ws.getRow(6).height = 15;

    // Satır 7'den: Veriler
    const toplamKol = {};
    isletmeciler.forEach((ist,idx)=>{
      const r=ws.getRow(7+idx); r.height=17;
      r.getCell(1).value=idx+1; s(r.getCell(1),idx%2?'FFF5FAF7':null,null,false,'center',true);
      r.getCell(2).value=ist.sahip||'—'; s(r.getCell(2),idx%2?'FFF5FAF7':null,null,false,'left',true);
      for(let c=3;c<=N+2;c++){r.getCell(c).value=null;s(r.getCell(c),idx%2?'FFF5FAF7':null,null,false,'center',true);}
      const kd = katToKolon(ist.kategoriler||{});
      KOLONLAR.forEach((kolon,ki)=>{
        if(kd[kolon]){
          const c=ki+3;
          r.getCell(c).value=kd[kolon];
          s(r.getCell(c),idx%2?'FFF5FAF7':null,null,false,'center',true);
          toplamKol[kolon]=(toplamKol[kolon]||0)+kd[kolon];
        }
      });
      r.getCell(N+3).value=ist.toplam_bbhb; r.getCell(N+3).numFmt='#,##0.00';
      s(r.getCell(N+3),idx%2?'FFF5FAF7':null,null,true,'right',true);
    });

    // Toplam satırı
    const totR=7+isletmeciler.length, totRow=ws.getRow(totR); totRow.height=20;
    ws.mergeCells(`A${totR}:B${totR}`);
    totRow.getCell(1).value='TOPLAM'; s(totRow.getCell(1),LG,null,true,'center',true);
    KOLONLAR.forEach((k,i)=>{totRow.getCell(i+3).value=toplamKol[k]||null;s(totRow.getCell(i+3),LG,null,true,'center',true);});
    totRow.getCell(N+3).value=kayit.toplam_bbhb; totRow.getCell(N+3).numFmt='#,##0.00';
    s(totRow.getCell(N+3),LG,null,true,'right',true);

    // Özet
    const oR=totR+2;
    ws.mergeCells(`A${oR}:${lastCol}${oR}`); ws.getCell(`A${oR}`).value='ÖZET BİLGİLER';
    s(ws.getCell(`A${oR}`),G1,WH,true,'left'); ws.getRow(oR).height=18;
    const half=String.fromCharCode(64+Math.ceil((N+3)/2));
    const oSat=(r,et,dg)=>{
      ws.mergeCells(`A${r}:${half}${r}`); ws.getCell(`A${r}`).value=et; s(ws.getCell(`A${r}`),MG,null,true,'left',true);
      ws.mergeCells(`${String.fromCharCode(half.charCodeAt(0)+1)}${r}:${lastCol}${r}`);
      ws.getCell(`${String.fromCharCode(half.charCodeAt(0)+1)}${r}`).value=dg; s(ws.getCell(`${String.fromCharCode(half.charCodeAt(0)+1)}${r}`),null,null,false,'left',true);
      ws.getRow(r).height=15;
    };
    oSat(oR+1,'Toplam Hayvan Sayısı',kayit.toplam_adet.toLocaleString('tr-TR')+' baş');
    oSat(oR+2,'Toplam BBHB',kayit.toplam_bbhb.toFixed(2));
    oSat(oR+3,'İşletmeci Sayısı',String(isletmeciler.length));
    oSat(oR+4,'Tahmini Canlı Ağırlık',(kayit.toplam_bbhb*500).toLocaleString('tr-TR')+' kg');
    oSat(oR+5,'Yeşil Kaba Yem (180 gün)',(kayit.toplam_bbhb*50*180).toLocaleString('tr-TR')+' kg');
    oSat(oR+6,'Kuru Kaba Yem (180 gün)',(kayit.toplam_bbhb*12.5*180).toLocaleString('tr-TR')+' kg');

    // Mera vasıf tablosu
    const mR=oR+8;
    ws.mergeCells(`A${mR}:${lastCol}${mR}`);
    ws.getCell(`A${mR}`).value=`180 Günlük Dönem Mera Miktarı (${mera.gun} gün × ${mera.gunlukYem} kg/BBHB/gün)${mera.kusak?' – '+kayit.il+' ili, '+mera.kusak+' mm':' – Genel ort.'}`;
    s(ws.getCell(`A${mR}`),G1,WH,true,'left'); ws.getRow(mR).height=18;
    const mSat=(r,vasif,alan,verim)=>{
      ws.mergeCells(`A${r}:H${r}`); ws.getCell(`A${r}`).value=vasif; s(ws.getCell(`A${r}`),LB,null,true,'left',true);
      ws.mergeCells(`I${r}:M${r}`); ws.getCell(`I${r}`).value=alan!=null?mera.fmt(alan)+' da':'-'; s(ws.getCell(`I${r}`),null,null,false,'left',true);
      ws.mergeCells(`N${r}:${lastCol}${r}`); ws.getCell(`N${r}`).value=verim?'('+verim+' kg/da)':''; s(ws.getCell(`N${r}`),null,'FF888888',false,'left',true);
      ws.getRow(r).height=15;
    };
    mSat(mR+1,'🟢 Çok İyi Vasıf Mera',mera.cok_iyi,mera.verim?.cok_iyi);
    mSat(mR+2,'🔵 İyi Vasıf Mera',mera.iyi,mera.verim?.iyi);
    mSat(mR+3,'🟡 Orta Vasıf Mera',mera.orta,mera.verim?.orta);
    mSat(mR+4,'🔴 Zayıf Vasıf Mera',mera.zayif,mera.verim?.zayif);

    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename=bbhb_${kayit._id}.xlsx`);
    await wb.xlsx.write(res); res.end();
  } catch(err){next(err);}
};


// ── PDF RAPOR ──────────────────────────────────────────────
const pdfRapor = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success:false, message:'Kayıt bulunamadı' });
    const mera = await meraHesapla(kayit.toplam_bbhb, kayit.il);
    const isletmeciler = isletmecileriGetir(kayit);
    const tarih = new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    const yer = yerOlustur(kayit.il, kayit.ilce, kayit.mahalle);

    const toplamKolon = {};
    const dataSatirlari = isletmeciler.map((ist,idx)=>{
      const kd = katToKolon(ist.kategoriler);
      KOLONLAR.forEach(k=>{if(kd[k])toplamKolon[k]=(toplamKolon[k]||0)+kd[k];});
      return `<tr class="${idx%2?'alt':''}">
        <td class="c">${idx+1}</td><td class="l">${ist.sahip||'—'}</td>
        ${KOLONLAR.map(k=>`<td class="c">${kd[k]||''}</td>`).join('')}
        <td class="r fw">${ist.toplam_bbhb.toFixed(2)}</td></tr>`;
    }).join('');

    const vasifSatiri = (simge,vasif,alan,verim) => alan!=null
      ? `<div class="ms"><span class="me">${simge} ${vasif}</span><span class="ma">${mera.fmt(alan)} da</span><span class="mv">(verim: ${verim} kg/da)</span></div>` : '';

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:7.5pt;color:#111;padding:8mm 10mm}
.yer{font-size:9pt;text-align:center;margin-bottom:2mm;color:#333;font-weight:600}
h1{font-size:10pt;font-weight:bold;text-align:center;margin-bottom:2mm;color:#0F6E56;text-transform:uppercase;border-bottom:2px solid #0F6E56;padding-bottom:2mm}
.meta{margin-bottom:2mm;font-size:8pt;display:flex;gap:8mm}
table{width:100%;border-collapse:collapse;margin-bottom:3mm;font-size:7pt}
.ust th{background:#0F6E56;color:#fff;text-align:center;padding:2pt;border:1px solid rgba(255,255,255,.3)}
th{background:#1D9E75;color:#fff;text-align:center;padding:1.5pt;border:1px solid rgba(255,255,255,.3)}
th.kat{background:#FFF8E1;color:#6D4C00;font-size:6pt;font-style:italic;font-weight:bold}
td{padding:1.5pt 2pt;border:1px solid #e0e0e0;vertical-align:middle}
td.c{text-align:center}td.r{text-align:right}td.l{text-align:left}td.fw{font-weight:bold}
tr.alt td{background:#f5faf7}
.toplam td{font-weight:bold;background:#e1f5ee;border-top:2px solid #0F6E56}
.ozet{margin-top:3mm;padding:3mm 4mm;background:#e1f5ee;border-radius:4px;border-left:3px solid #0F6E56;font-size:7.5pt}
.og{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin-bottom:3mm}
.et{font-size:6.5pt;color:#555}.dg{font-weight:bold;font-size:9pt;color:#0a3622}
.mb{margin-top:3mm;padding:3mm 4mm;background:#c8ead8;border-radius:3px}
.mb-t{font-size:7.5pt;font-weight:bold;color:#0a3622;margin-bottom:3mm}
.ms{display:flex;align-items:baseline;gap:6px;margin-bottom:2mm}
.me{font-size:7.5pt;font-weight:bold;color:#0F6E56;min-width:130px}
.ma{font-size:9.5pt;font-weight:bold;color:#0a3622}
.mv{font-size:6.5pt;color:#666}
.footer{margin-top:4mm;font-size:7pt;color:#aaa;text-align:center;border-top:1px solid #ddd;padding-top:2mm}
@media print{body{padding:5mm 7mm}}
</style></head><body>
${yer?`<div class="yer">${yer}</div>`:''}
<h1>Büyükbaş Hayvan Birimi (BBHB) Raporu</h1>
<div class="meta"><span><strong>Tarih:</strong> ${tarih}</span>${kayit.il?`<span><strong>İl:</strong> ${kayit.il}</span>`:''}</div>
<table>
  <thead>
    <tr class="ust">
      <th rowspan="3" style="width:20px">Sıra No</th>
      <th rowspan="3" style="min-width:100px">İkamet Eden Aile Temsilcisinin Adı Soyadı (Aile)</th>
      ${TABLO_GRUPLARI.map(g=>`<th colspan="${g.span}">${g.ad}</th>`).join('')}
      <th rowspan="3">Toplam BBHB</th>
    </tr>
    <tr>${KOLONLAR_KISA.map(v=>`<th>${v}</th>`).join('')}</tr>
    <tr>${KOLONLAR.map(k=>`<th class="kat">${KOLON_KATSAYI[k]}</th>`).join('')}</tr>
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
  <div class="og">
    <div><div class="et">Toplam Hayvan Sayısı</div><div class="dg">${kayit.toplam_adet.toLocaleString('tr-TR')} baş</div></div>
    <div><div class="et">Toplam BBHB</div><div class="dg">${kayit.toplam_bbhb.toFixed(2)}</div></div>
    <div><div class="et">İşletmeci Sayısı</div><div class="dg">${isletmeciler.length}</div></div>
    <div><div class="et">Tahmini Canlı Ağırlık</div><div class="dg">${(kayit.toplam_bbhb*500).toLocaleString('tr-TR')} kg</div></div>
    <div><div class="et">Yeşil Kaba Yem (180 gün)</div><div class="dg">${(kayit.toplam_bbhb*50*180).toLocaleString('tr-TR')} kg</div></div>
    <div><div class="et">Kuru Kaba Yem (180 gün)</div><div class="dg">${(kayit.toplam_bbhb*12.5*180).toLocaleString('tr-TR')} kg</div></div>
  </div>
  <div class="mb">
    <div class="mb-t">180 Günlük Dönem İçin Gerekli Mera Miktarı (${mera.gun} gün × ${mera.gunlukYem} kg/BBHB/gün)${mera.kusak?' — '+kayit.il+' ili, '+mera.kusak+' mm yağış kuşağı':' — Genel ortalama'}</div>
    ${vasifSatiri('🟢','Çok İyi Vasıf Mera',mera.cok_iyi,mera.verim?.cok_iyi)}
    ${vasifSatiri('🔵','İyi Vasıf Mera',mera.iyi,mera.verim?.iyi)}
    ${vasifSatiri('🟡','Orta Vasıf Mera',mera.orta,mera.verim?.orta)}
    ${vasifSatiri('🔴','Zayıf Vasıf Mera',mera.zayif,mera.verim?.zayif)}
  </div>
</div>
<div class="footer">MİS – Mera İzleme Sistemi &nbsp;|&nbsp; ${tarih}</div>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.send(html);
  } catch(err){next(err);}
};

// ── WORD RAPOR ─────────────────────────────────────────────
const wordRapor = async (req, res, next) => {
  try {
    const kayit = await BBHBHesaplama.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success:false, message:'Kayıt bulunamadı' });
    const mera = await meraHesapla(kayit.toplam_bbhb, kayit.il);
    const isletmeciler = isletmecileriGetir(kayit);
    const tarih = new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    const yer = yerOlustur(kayit.il, kayit.ilce, kayit.mahalle);

    const G1='0F6E56', G2='1D9E75', LG='E1F5EE', MG='C8EAD8', YL='FFF8E1', LB='E8F4FD';
    const N = KOLONLAR.length;

    const hc = (text, bold=false, bg=null, color='000000', size=18, align=AlignmentType.CENTER) =>
      new TableCell({
        children:[new Paragraph({children:[new TextRun({text:String(text??''),bold,size,color})],alignment:align})],
        shading:bg?{type:'solid',color:bg,fill:bg}:undefined,
        margins:{top:40,bottom:40,left:60,right:60},
      });

    const span = (text,cs,bg,color='FFFFFF') =>
      new TableCell({
        children:[new Paragraph({children:[new TextRun({text,bold:true,size:18,color})],alignment:AlignmentType.CENTER})],
        columnSpan:cs, shading:{type:'solid',color:bg,fill:bg}, margins:{top:40,bottom:40,left:60,right:60},
      });

    // Başlık satırları — No, İsim, BBHB 3 satır birleşik
    const b1 = new TableRow({children:[
      new TableCell({
        rowSpan:3,
        children:[new Paragraph({children:[new TextRun({text:'No',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})],
        shading:{type:'solid',color:G1,fill:G1}, margins:{top:40,bottom:40,left:60,right:60},
        verticalAlign:'center',
      }),
      new TableCell({
        rowSpan:3,
        children:[new Paragraph({children:[new TextRun({text:'İkamet Eden Aile Temsilcisinin Adı Soyadı (Aile)',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})],
        shading:{type:'solid',color:G1,fill:G1}, margins:{top:40,bottom:40,left:60,right:60},
        verticalAlign:'center',
      }),
      span('Büyükbaş, Küçükbaş ve Diğer Hayvan Varlıkları',N,G1),
      new TableCell({
        rowSpan:3,
        children:[new Paragraph({children:[new TextRun({text:'Top.\nBBHB',bold:true,size:18,color:'FFFFFF'})],alignment:AlignmentType.CENTER})],
        shading:{type:'solid',color:G2,fill:G2}, margins:{top:40,bottom:40,left:60,right:60},
        verticalAlign:'center',
      }),
    ]});
    const b2 = new TableRow({children:[
      ...TABLO_GRUPLARI.map(g => span(g.ad, g.span, G2)),
    ]});
    const b3 = new TableRow({children:[
      ...KOLONLAR_KISA.map(v=>hc(v,true,G2,'FFFFFF',16)),
    ]});
    // Katsayı satırı
    const bKat = new TableRow({children:[
      hc('BBHB\nKat.',true,YL,'6D4C00',15),
      hc('',false,YL),
      ...KOLONLAR.map(k=>hc(String(KOLON_KATSAYI[k]??''),true,YL,'6D4C00',15)),
      hc('',false,YL),
    ]});

    const toplamKol={};
    const veriSatirlari = isletmeciler.map((ist,idx)=>{
      const kd = katToKolon(ist.kategoriler||{});
      KOLONLAR.forEach(k=>{ if(kd[k]) toplamKol[k]=(toplamKol[k]||0)+kd[k]; });
      const bg=idx%2?'F5FAF7':null;
      return new TableRow({children:[
        hc(idx+1,false,bg),
        new TableCell({children:[new Paragraph({children:[new TextRun({text:ist.sahip||'—',size:18})],alignment:AlignmentType.LEFT})],shading:bg?{type:'solid',color:bg,fill:bg}:undefined,margins:{top:40,bottom:40,left:80,right:60}}),
        ...KOLONLAR.map(k=>hc(kd[k]||'',false,bg)),
        hc(ist.toplam_bbhb?.toFixed(2)||'',true,bg),
      ]});
    });

    const toplamSatiri = new TableRow({children:[
      span('TOPLAM',2,LG,'000000'),
      ...KOLONLAR.map(k=>hc(toplamKol[k]||'',true,LG)),
      hc(kayit.toplam_bbhb?.toFixed(2)||'',true,LG),
    ]});

    // Özet paragrafları
    const op=(et,dg)=>new Paragraph({children:[new TextRun({text:et+': ',bold:true,size:20}),new TextRun({text:dg,size:20})],spacing:{after:60}});
    const meraVasif=(simge,vasif,alan,verim)=>alan!=null?new Paragraph({children:[
      new TextRun({text:`${simge} ${vasif}: `,bold:true,size:20,color:G1}),
      new TextRun({text:`${mera.fmt(alan)} da`,bold:true,size:22}),
      new TextRun({text:`  (verim: ${verim} kg/da)`,size:17,color:'888888'}),
    ],spacing:{after:60}}):null;

    const doc = new Document({sections:[{properties:{page:{margin:{top:720,right:720,bottom:720,left:720}}},children:[
      ...(yer?[new Paragraph({children:[new TextRun({text:yer,bold:true,size:22})],alignment:AlignmentType.CENTER,spacing:{after:80}})]:[]),
      new Paragraph({children:[new TextRun({text:'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU',bold:true,size:26,color:G1})],alignment:AlignmentType.CENTER,spacing:{after:80}}),
      new Paragraph({children:[new TextRun({text:`Tarih: ${tarih}`,size:20})],spacing:{after:160}}),
      new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[b1,b2,b3,bKat,...veriSatirlari,toplamSatiri]}),
      new Paragraph({children:[new TextRun({text:'ÖZET BİLGİLER',bold:true,size:22,color:G1})],spacing:{before:200,after:80}}),
      op('Toplam Hayvan Sayısı',kayit.toplam_adet.toLocaleString('tr-TR')+' baş'),
      op('Toplam BBHB',kayit.toplam_bbhb.toFixed(2)),
      op('İşletmeci Sayısı',String(isletmeciler.length)),
      op('Tahmini Canlı Ağırlık',(kayit.toplam_bbhb*500).toLocaleString('tr-TR')+' kg'),
      op('Yeşil Kaba Yem (180 gün)',(kayit.toplam_bbhb*50*180).toLocaleString('tr-TR')+' kg'),
      op('Kuru Kaba Yem (180 gün)',(kayit.toplam_bbhb*12.5*180).toLocaleString('tr-TR')+' kg'),
      new Paragraph({children:[new TextRun({text:`180 Günlük Dönem İçin Gerekli Mera Miktarı (${mera.gun} gün × ${mera.gunlukYem} kg/BBHB/gün)${mera.kusak?' — '+kayit.il+' ili, '+mera.kusak+' mm':' — Genel ort.'}`,bold:true,size:20})],spacing:{before:160,after:80}}),
      meraVasif('🟢','Çok İyi Vasıf Mera',mera.cok_iyi,mera.verim?.cok_iyi),
      meraVasif('🔵','İyi Vasıf Mera',mera.iyi,mera.verim?.iyi),
      meraVasif('🟡','Orta Vasıf Mera',mera.orta,mera.verim?.orta),
      meraVasif('🔴','Zayıf Vasıf Mera',mera.zayif,mera.verim?.zayif),
    ].filter(Boolean)}]});

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition',`attachment; filename=bbhb_${kayit._id}.docx`);
    res.send(buffer);
  } catch(err){next(err);}
};

module.exports = { getTurler, hesapla, kaydet, listele, getById, sil, excelRapor, pdfRapor, wordRapor, HAYVAN_TURLERI };
