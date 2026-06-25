const BBHBHesaplama = require('./bbhb.model');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle } = require('docx');

// ── Hayvan türleri ve BBHB katsayıları ────────────────────
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

// Sütun başlığı → BBHB katsayısı (rapor tablo başlığı satırı için)
const KOLON_KATSAYI = {
  'Kültür Irkı İnek':     1.00,
  'Kültür Irkı Da-Dü':   0.60,
  'Kültür Melezi İnek':  0.75,
  'Kültür Melezi Da-Dü': 0.45,
  'Yerli Irk İnek':      0.50,
  'Yerli Irk Da-Dü':     0.30,
  'Koyun':               0.10,
  'Kuzu':                0.04,
  'Keçi':                0.08,
  'At':                  0.50,
  'Eşek':                0.30,
};

// Yer başlığı oluştur  →  "İstanbul İli Silivri İlçesi Akören Mahallesi/Köyü"
const yerOlustur = (il, ilce, mahalle) => [
  il      ? il      + ' İli'           : '',
  ilce    ? ilce    + ' İlçesi'        : '',
  mahalle ? mahalle + ' Mahallesi/Köyü': '',
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
const KOLONLAR = [
  'Kültür Irkı İnek','Kültür Irkı Da-Dü',
  'Kültür Melezi İnek','Kültür Melezi Da-Dü',
  'Yerli Irk İnek','Yerli Irk Da-Dü',
  'Koyun','Kuzu','Keçi','At','Eşek',
];
const KOLONLAR_KISA = ['İnek','Da-Dü','İnek','Da-Dü','İnek','Da-Dü','Koyun','Kuzu','Keçi','At','Eşek'];
const KAT_KOLON = {
  'Kültür ırkı süt ineği':'Kültür Irkı İnek','Dana-düve (kültür ırkı)':'Kültür Irkı Da-Dü',
  'Kültür melezi':'Kültür Melezi İnek','Dana-düve (kültür melezi)':'Kültür Melezi Da-Dü',
  'Yerli inek':'Yerli Irk İnek','Dana-düve (yerli)':'Yerli Irk Da-Dü',
  'Koyun':'Koyun','Kuzu-oğlak':'Kuzu','Keçi':'Keçi','At':'At','Eşek':'Eşek',
};
const KAT_COL_NUM = {
  'Kültür ırkı süt ineği':3,'Dana-düve (kültür ırkı)':4,
  'Kültür melezi':5,'Dana-düve (kültür melezi)':6,
  'Yerli inek':7,'Dana-düve (yerli)':8,
  'Koyun':9,'Kuzu-oğlak':10,'Keçi':11,'At':12,'Eşek':13,
};

// İşletmeci listesi normalize et
const isletmecileriGetir = (kayit) =>
  Array.isArray(kayit.isletmeciler) && kayit.isletmeciler.length > 0
    ? kayit.isletmeciler
    : [{ sahip: kayit.ciftci_ad||'-',
         kategoriler: Object.fromEntries(kayit.hayvanlar.filter(h=>h.adet>0).map(h=>[h.tur_adi,{adet:h.adet,bbhb:h.bbhb}])),
         toplam_adet: kayit.toplam_adet, toplam_bbhb: kayit.toplam_bbhb }];

// Kategori → kolon eşleştir
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

    const wb = new ExcelJS.Workbook();
    wb.creator = 'MİS - Mera İzleme Sistemi';
    const ws = wb.addWorksheet('BBHB');

    const G1='FF0F6E56', G2='FF1D9E75', WH='FFFFFFFF', LG='FFE1F5EE', MG='FFC8EAD8', YL='FFFFF8E1', LB='FFE8F4FD';
    ws.columns = [{width:6},{width:32},{width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:9},{width:12}];

    const s = (cell, bg, color, bold, align, border) => {
      if (bg) cell.fill = {type:'pattern',pattern:'solid',fgColor:{argb:bg}};
      cell.font = {bold:!!bold, color:{argb:color||'FF000000'}, size:10};
      cell.alignment = {horizontal:align||'center',vertical:'middle',wrapText:true};
      if (border) { const b={style:'thin',color:{argb:'FFCCCCCC'}}; cell.border={top:b,bottom:b,left:b,right:b}; }
    };

    // Satır 1: Yer
    ws.mergeCells('A1:N1');
    ws.getCell('A1').value = yerOlustur(kayit.il,kayit.ilce,kayit.mahalle) || 'BBHB RAPORU';
    s(ws.getCell('A1'),G1,WH,true,'center'); ws.getRow(1).height=22;

    // Satır 2: Başlık
    ws.mergeCells('A2:N2');
    ws.getCell('A2').value = 'BÜYÜK BAŞ HAYVAN BİRİMİ (BBHB) RAPORU';
    s(ws.getCell('A2'),G1,WH,true,'center'); ws.getRow(2).height=22;

    // Satır 3: Tarih
    ws.mergeCells('A3:G3');
    ws.getCell('A3').value = 'Tarih: '+new Date(kayit.createdAt).toLocaleDateString('tr-TR');
    s(ws.getCell('A3'),null,null,false,'left'); ws.getRow(3).height=16;

    // Satır 4: Üst başlık (A-B rowspan 3, N rowspan 3)
    ws.mergeCells('A4:A7'); ws.getCell('A4').value='Sıra\nNo'; s(ws.getCell('A4'),G1,WH,true);
    ws.mergeCells('B4:B7'); ws.getCell('B4').value='İkamet Eden Aile Temsilcisinin\nAdı Soyadı (Aile)'; s(ws.getCell('B4'),G1,WH,true);
    ws.mergeCells('C4:N4'); ws.getCell('C4').value='Büyükbaş, Küçükbaş ve Diğer Hayvan Varlıkları'; s(ws.getCell('C4'),G1,WH,true); ws.getRow(4).height=26;

    // Satır 5: Grup başlıkları
    [['C5:D5','Kültür Irkı'],['E5:F5','Kültür Melezi'],['G5:H5','Yerli Irk'],['I5:K5','Küçükbaş'],['L5:M5','Tek Tırnaklı']].forEach(([r,v])=>{
      ws.mergeCells(r); s(ws.getCell(r.split(':')[0]),G2,WH,true); ws.getCell(r.split(':')[0]).value=v;
    });
    ws.mergeCells('N5:N7'); ws.getCell('N5').value='Toplam\nBBHB'; s(ws.getCell('N5'),G2,WH,true); ws.getRow(5).height=18;

    // Satır 6: Hayvan adları
    KOLONLAR_KISA.forEach((v,i)=>{ const c=ws.getRow(6).getCell(i+3); c.value=v; s(c,G2,WH,true); }); ws.getRow(6).height=18;

    // Satır 7: BBHB Katsayıları ← YENİ SATIR
    KOLONLAR.forEach((k,i)=>{ const c=ws.getRow(7).getCell(i+3); c.value=KOLON_KATSAYI[k]??''; c.numFmt='0.00'; s(c,YL,'FF6D4C00',true); }); ws.getRow(7).height=16;

    // Veri satırları (satır 8'den)
    const toplamKol = {};
    isletmeciler.forEach((ist,idx)=>{
      const r=ws.getRow(8+idx); r.height=18;
      r.getCell(1).value=idx+1; s(r.getCell(1),idx%2?'FFF5FAF7':null,null,false,'center',true);
      r.getCell(2).value=ist.sahip||'—'; s(r.getCell(2),idx%2?'FFF5FAF7':null,null,false,'left',true);
      for(let c=3;c<=13;c++){r.getCell(c).value=null;s(r.getCell(c),idx%2?'FFF5FAF7':null,null,false,'center',true);}
      Object.entries(ist.kategoriler||{}).forEach(([kat,v])=>{
        const col=KAT_COL_NUM[kat]; if(!col)return;
        r.getCell(col).value=v.adet||null; s(r.getCell(col),idx%2?'FFF5FAF7':null,null,false,'center',true);
        toplamKol[col]=(toplamKol[col]||0)+(v.adet||0);
      });
      r.getCell(14).value=ist.toplam_bbhb; r.getCell(14).numFmt='#,##0.00'; s(r.getCell(14),idx%2?'FFF5FAF7':null,null,true,'right',true);
    });

    // Toplam satırı
    const totR=8+isletmeciler.length, totRow=ws.getRow(totR); totRow.height=20;
    ws.mergeCells(`A${totR}:B${totR}`);
    totRow.getCell(1).value='TOPLAM'; s(totRow.getCell(1),LG,null,true,'center',true);
    for(let c=3;c<=13;c++){totRow.getCell(c).value=toplamKol[c]||null;s(totRow.getCell(c),LG,null,true,'center',true);}
    totRow.getCell(14).value=kayit.toplam_bbhb; totRow.getCell(14).numFmt='#,##0.00'; s(totRow.getCell(14),LG,null,true,'right',true);

    // Özet
    const oR=totR+2;
    ws.mergeCells(`A${oR}:N${oR}`); ws.getCell(`A${oR}`).value='ÖZET BİLGİLER'; s(ws.getCell(`A${oR}`),G1,WH,true,'left'); ws.getRow(oR).height=18;
    const oSat=(r,et,dg)=>{ws.mergeCells(`A${r}:G${r}`);ws.getCell(`A${r}`).value=et;s(ws.getCell(`A${r}`),MG,null,true,'left',true);ws.mergeCells(`H${r}:N${r}`);ws.getCell(`H${r}`).value=dg;s(ws.getCell(`H${r}`),null,null,false,'left',true);ws.getRow(r).height=15;};
    oSat(oR+1,'Toplam Hayvan Sayısı',kayit.toplam_adet.toLocaleString('tr-TR')+' baş');
    oSat(oR+2,'Toplam BBHB',kayit.toplam_bbhb.toFixed(2));
    oSat(oR+3,'İşletmeci Sayısı',String(isletmeciler.length));
    oSat(oR+4,'Tahmini Canlı Ağırlık',(kayit.toplam_bbhb*500).toLocaleString('tr-TR')+' kg');
    oSat(oR+5,'Yeşil Kaba Yem (180 gün)',(kayit.toplam_bbhb*50*180).toLocaleString('tr-TR')+' kg');
    oSat(oR+6,'Kuru Kaba Yem (180 gün)',(kayit.toplam_bbhb*12.5*180).toLocaleString('tr-TR')+' kg');

    // Mera vasıf tablosu
    const mR=oR+8;
    ws.mergeCells(`A${mR}:N${mR}`);
    ws.getCell(`A${mR}`).value=`180 Günlük Dönem Mera Miktarı (${mera.gun} gün × ${mera.gunlukYem} kg/BBHB/gün)${mera.kusak?' – '+kayit.il+' ili, '+mera.kusak+' mm':' – Genel ort.'}`;
    s(ws.getCell(`A${mR}`),G1,WH,true,'left'); ws.getRow(mR).height=18;
    const mSat=(r,vasif,alan,verim)=>{ws.mergeCells(`A${r}:G${r}`);ws.getCell(`A${r}`).value=vasif;s(ws.getCell(`A${r}`),LB,null,true,'left',true);ws.mergeCells(`H${r}:K${r}`);ws.getCell(`H${r}`).value=alan!=null?mera.fmt(alan)+' da':'-';s(ws.getCell(`H${r}`),null,null,false,'left',true);ws.mergeCells(`L${r}:N${r}`);ws.getCell(`L${r}`).value=verim?'('+verim+' kg/da)':'';s(ws.getCell(`L${r}`),null,'FF888888',false,'left',true);ws.getRow(r).height=15;};
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
body{font-family:Arial,sans-serif;font-size:8.5pt;color:#111;padding:10mm 12mm}
.yer{font-size:9.5pt;text-align:center;margin-bottom:2mm;color:#333;font-weight:600}
h1{font-size:11pt;font-weight:bold;text-align:center;margin-bottom:3mm;color:#0F6E56;text-transform:uppercase;border-bottom:2px solid #0F6E56;padding-bottom:2mm}
.meta{margin-bottom:2mm;font-size:8.5pt;display:flex;gap:8mm}
table{width:100%;border-collapse:collapse;margin-bottom:3mm;font-size:8pt}
.ust th{background:#0F6E56;color:#fff;text-align:center;padding:3pt;border:1px solid rgba(255,255,255,.3)}
th{background:#1D9E75;color:#fff;text-align:center;padding:2pt;border:1px solid rgba(255,255,255,.3)}
th.kat{background:#FFF8E1;color:#6D4C00;font-size:7pt;font-style:italic;font-weight:bold}
td{padding:2pt 3pt;border:1px solid #e0e0e0;vertical-align:middle}
td.c{text-align:center}td.r{text-align:right}td.l{text-align:left}td.fw{font-weight:bold}
tr.alt td{background:#f5faf7}
.toplam td{font-weight:bold;background:#e1f5ee;border-top:2px solid #0F6E56}
.ozet{margin-top:3mm;padding:3mm 4mm;background:#e1f5ee;border-radius:4px;border-left:3px solid #0F6E56;font-size:8pt}
.og{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin-bottom:3mm}
.et{font-size:7pt;color:#555}.dg{font-weight:bold;font-size:9.5pt;color:#0a3622}
.mb{margin-top:3mm;padding:3mm 4mm;background:#c8ead8;border-radius:3px}
.mb-t{font-size:8pt;font-weight:bold;color:#0a3622;margin-bottom:3mm}
.ms{display:flex;align-items:baseline;gap:6px;margin-bottom:2mm}
.me{font-size:8pt;font-weight:bold;color:#0F6E56;min-width:130px}
.ma{font-size:10pt;font-weight:bold;color:#0a3622}
.mv{font-size:7pt;color:#666}
.footer{margin-top:4mm;font-size:7.5pt;color:#aaa;text-align:center;border-top:1px solid #ddd;padding-top:2mm}
@media print{body{padding:6mm 8mm}}
</style></head><body>
${yer?`<div class="yer">${yer}</div>`:''}
<h1>Büyükbaş Hayvan Birimi (BBHB) Raporu</h1>
<div class="meta"><span><strong>Tarih:</strong> ${tarih}</span>${kayit.il?`<span><strong>İl:</strong> ${kayit.il}</span>`:''}</div>
<table>
  <thead>
    <tr class="ust">
      <th rowspan="3" style="width:24px">Sıra No</th>
      <th rowspan="3" style="min-width:130px">İkamet Eden Aile Temsilcisinin Adı Soyadı (Aile)</th>
      <th colspan="2">Kültür Irkı</th><th colspan="2">Kültür Melezi</th>
      <th colspan="2">Yerli Irk</th><th colspan="3">Küçükbaş</th>
      <th colspan="2">Tek Tırnaklı</th>
      <th rowspan="3">Toplam BBHB</th>
    </tr>
    <tr>${KOLONLAR_KISA.map(v=>`<th>${v}</th>`).join('')}</tr>
    <tr>${KOLONLAR.map(k=>`<th class="kat">${KOLON_KATSAYI[k]??''}</th>`).join('')}</tr>
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
    const KISA = ['Kü.Irkı\nİnek','Kü.Irkı\nDa-Dü','Melez\nİnek','Melez\nDa-Dü','Yerli\nİnek','Yerli\nDa-Dü','Koyun','Kuzu','Keçi','At','Eşek'];

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

    // 3 başlık satırı
    const b1 = new TableRow({children:[
      hc('No',true,G1,'FFFFFF'),
      hc('İkamet Eden Aile Temsilcisinin Adı Soyadı (Aile)',true,G1,'FFFFFF'),
      span('Büyükbaş, Küçükbaş ve Diğer Hayvan Varlıkları',12,G1),
    ]});
    const b2 = new TableRow({children:[
      hc('',true,G2,'FFFFFF'), hc('',true,G2,'FFFFFF'),
      span('Kültür Irkı',2,G2), span('Kültür Melezi',2,G2), span('Yerli Irk',2,G2),
      span('Küçükbaş',3,G2), span('Tek Tırnaklı',2,G2),
      hc('Top.\nBBHB',true,G2,'FFFFFF'),
    ]});
    const b3 = new TableRow({children:[
      hc('',true,G2,'FFFFFF'), hc('',true,G2,'FFFFFF'),
      ...KISA.map(v=>hc(v,true,G2,'FFFFFF',16)),
    ]});
    // Katsayı satırı ← YENİ
    const bKat = new TableRow({children:[
      hc('BBHB\nKat.',true,YL,'6D4C00',16),
      hc('',false,YL),
      ...KOLONLAR.map(k=>hc(String(KOLON_KATSAYI[k]??''),true,YL,'6D4C00',16)),
    ]});

    // Veri satırları
    const toplamKol={};
    const veriSatirlari = isletmeciler.map((ist,idx)=>{
      const kd={};
      Object.entries(ist.kategoriler||{}).forEach(([kat,v])=>{const c=KAT_COL_NUM[kat];if(c){kd[c]=(kd[c]||0)+(v.adet||0);toplamKol[c]=(toplamKol[c]||0)+(v.adet||0);}});
      const bg=idx%2?'F5FAF7':null;
      return new TableRow({children:[
        hc(idx+1,false,bg),
        new TableCell({children:[new Paragraph({children:[new TextRun({text:ist.sahip||'—',size:18})],alignment:AlignmentType.LEFT})],shading:bg?{type:'solid',color:bg,fill:bg}:undefined,margins:{top:40,bottom:40,left:80,right:60}}),
        ...[3,4,5,6,7,8,9,10,11,12,13].map(c=>hc(kd[c]||'',false,bg)),
        hc(ist.toplam_bbhb?.toFixed(2)||'',true,bg),
      ]});
    });

    const toplamSatiri = new TableRow({children:[
      span('TOPLAM',2,LG,'000000'),
      ...[3,4,5,6,7,8,9,10,11,12,13].map(c=>hc(toplamKol[c]||'',true,LG)),
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
