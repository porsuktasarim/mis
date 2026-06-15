const { EhgbParametre, EhgbHesap } = require('./ehgb.model');

// ── Varsayılan Parametreler (2026) ────────────────────────
const VARSAYILAN_PARAMETRELER = {
  // İşçilik (TL/da)
  derin_surum: 511.87,
  surum_pulluk: 354.94,
  ikilem: 266.21,
  tirmik: 342.90,
  gubreleme: 179.90,
  ekim: 658.24,
  temizlik_tesviye: 342.90,
  // Hafriyat
  arac_kapasite_m3: 14,
  ozgul_agirlik: 1600,       // kg/m3
  torba_kg: 60,
  yukleme_baz: 162,           // 1200 kg'a kadar TL
  yukleme_ilave_torba: 11,    // her 60 kg fazlası TL
  nakliye_km: 5,              // TL/km tek yön
  depolama_giris: 5771,       // TL/araç
  // Diğer işçilik
  toprak_serme: 1874.50,      // TL/da (B+C için 1.5x)
  asfalt_sokum: 288.90,       // TL/m3
  tel_orgu: 121.25,           // TL/m
  // Toprak
  toprak_fiyati: 800,         // TL/m3
  // Tohum (oran, TL/kg)
  tohumlar: [
    { ad: 'İtalyan çimi',           oran: 0.20, fiyat: 220 },
    { ad: 'Domuz ayrığı',           oran: 0.10, fiyat: 600 },
    { ad: 'Yüksek çayır yumağı',    oran: 0.15, fiyat: 500 },
    { ad: 'Çayır salkım otu',       oran: 0.15, fiyat: 750 },
    { ad: 'Yonca',                  oran: 0.15, fiyat: 800 },
    { ad: 'Ak üçgül',               oran: 0.15, fiyat: 900 },
    { ad: 'Korunga',                oran: 0.10, fiyat: 300 },
  ],
  tohum_miktar_da: 12,        // kg/da
  // Gübre
  amonyum_sulfat_fiyat: 25,   // TL/kg
  amonyum_sulfat_miktar: 20,  // kg/da (2 yıl)
  hayvan_gubres_fiyat: 3,     // TL/kg
  hayvan_gubres_miktar: 2000, // kg/da (1 yıl)
  kompoze_fiyat: 40,          // TL/kg
  kompoze_miktar: 20,         // kg/da (2 yıl)
};

// ── Hesaplama Motoru ─────────────────────────────────────
const hesaplaEHGB = (girdi, p) => {
  const {
    a_alan = 0,      // Sürülen/tarla m2
    b_alan = 0,      // İnşaat/hafriyat m2
    b_derinlik = 0,  // m
    c_alan = 0,      // Asfalt/beton m2
    c_kalinlik = 0,  // m
    tel_orgu_m = 0,  // m
    uzaklik_km = 0,  // km
  } = girdi;

  // Ara değerler
  const hacim_m3 = (b_alan * b_derinlik) + (c_alan * c_kalinlik);
  const toplam_alan_m2 = a_alan + b_alan + c_alan;
  const toplam_alan_da = toplam_alan_m2 / 1000;
  const bc_alan_da = (b_alan + c_alan) / 1000;
  const asfalt_m3 = c_alan * c_kalinlik;

  // İşçilik kalemleri
  const derin_surum     = p.derin_surum     * toplam_alan_da;
  const surum_pulluk    = p.surum_pulluk    * toplam_alan_da;
  const ikilem          = p.ikilem          * toplam_alan_da;
  const tirmik          = p.tirmik          * toplam_alan_da;
  const gubreleme_isc   = p.gubreleme       * toplam_alan_da;
  const ekim_isc        = p.ekim            * toplam_alan_da;
  const temizlik        = p.temizlik_tesviye * toplam_alan_da;

  // Hafriyat taşıma (3 bileşen)
  let hafriyat_iscilik = 0, hafriyat_nakliye = 0, hafriyat_depolama = 0;
  let sefer_sayisi = 0;
  if (hacim_m3 > 0 && uzaklik_km > 0) {
    sefer_sayisi = hacim_m3 / p.arac_kapasite_m3;
    const arac_yuk_kg = p.arac_kapasite_m3 * p.ozgul_agirlik;
    const ilave_torba = (arac_yuk_kg - 1200) / p.torba_kg;
    const sefer_basi_iscilik = p.yukleme_baz + (ilave_torba * p.yukleme_ilave_torba);
    hafriyat_iscilik  = sefer_basi_iscilik * sefer_sayisi;
    hafriyat_nakliye  = sefer_sayisi * p.nakliye_km * p.arac_kapasite_m3 * 2 * uzaklik_km;
    hafriyat_depolama = sefer_sayisi * p.depolama_giris;
  }
  const hafriyat_toplam = hafriyat_iscilik + hafriyat_nakliye + hafriyat_depolama;

  // Toprak serme (B+C alanı, 1.5x çarpan dahil — zaten birim fiyata dahil)
  const toprak_serme = bc_alan_da > 0 ? p.toprak_serme * bc_alan_da : 0;

  // Asfalt/beton sökümü
  const asfalt_sokum = asfalt_m3 > 0 ? p.asfalt_sokum * asfalt_m3 : 0;

  // Tel örgü
  const tel_orgu_bedel = tel_orgu_m > 0 ? p.tel_orgu * tel_orgu_m : 0;

  // İşçilik toplam
  const iscilik_toplam = derin_surum + surum_pulluk + ikilem + tirmik +
    gubreleme_isc + ekim_isc + temizlik + hafriyat_toplam +
    toprak_serme + asfalt_sokum + tel_orgu_bedel;

  // Tohum maliyeti (da başına × toplam alan)
  let tohum_toplam = 0;
  const tohum_detay = (p.tohumlar || VARSAYILAN_PARAMETRELER.tohumlar).map(t => {
    const miktar_da = t.oran * p.tohum_miktar_da;
    const maliyet_da = miktar_da * t.fiyat;
    const maliyet = maliyet_da * toplam_alan_da;
    tohum_toplam += maliyet;
    return { ad: t.ad, oran: t.oran, miktar_da, fiyat: t.fiyat, maliyet };
  });

  // Gübre maliyeti (2 yıl amonyum+kompoze, 1 yıl hayvan gübresi)
  const amonyum_m = p.amonyum_sulfat_fiyat * p.amonyum_sulfat_miktar * toplam_alan_da * 2;
  const hayvan_m  = p.hayvan_gubres_fiyat  * p.hayvan_gubres_miktar  * toplam_alan_da * 1;
  const kompoze_m = p.kompoze_fiyat        * p.kompoze_miktar        * toplam_alan_da * 2;
  const gubre_toplam = amonyum_m + hayvan_m + kompoze_m;

  const genel_toplam = iscilik_toplam + tohum_toplam + gubre_toplam;

  return {
    // Girdiler
    a_alan, b_alan, b_derinlik, c_alan, c_kalinlik, tel_orgu_m, uzaklik_km,
    // Ara değerler
    hacim_m3: +hacim_m3.toFixed(4),
    toplam_alan_m2, toplam_alan_da: +toplam_alan_da.toFixed(4),
    bc_alan_da: +bc_alan_da.toFixed(4),
    asfalt_m3: +asfalt_m3.toFixed(4),
    sefer_sayisi: +sefer_sayisi.toFixed(4),
    // İşçilik
    derin_surum: +derin_surum.toFixed(2),
    surum_pulluk: +surum_pulluk.toFixed(2),
    ikilem: +ikilem.toFixed(2),
    tirmik: +tirmik.toFixed(2),
    gubreleme_isc: +gubreleme_isc.toFixed(2),
    ekim_isc: +ekim_isc.toFixed(2),
    temizlik: +temizlik.toFixed(2),
    hafriyat_iscilik: +hafriyat_iscilik.toFixed(2),
    hafriyat_nakliye: +hafriyat_nakliye.toFixed(2),
    hafriyat_depolama: +hafriyat_depolama.toFixed(2),
    hafriyat_toplam: +hafriyat_toplam.toFixed(2),
    toprak_serme: +toprak_serme.toFixed(2),
    asfalt_sokum: +asfalt_sokum.toFixed(2),
    tel_orgu_bedel: +tel_orgu_bedel.toFixed(2),
    iscilik_toplam: +iscilik_toplam.toFixed(2),
    // Tohum
    tohum_detay,
    tohum_toplam: +tohum_toplam.toFixed(2),
    // Gübre
    amonyum_m: +amonyum_m.toFixed(2),
    hayvan_m: +hayvan_m.toFixed(2),
    kompoze_m: +kompoze_m.toFixed(2),
    gubre_toplam: +gubre_toplam.toFixed(2),
    // Genel
    genel_toplam: +genel_toplam.toFixed(2),
  };
};

// ── Parametreler CRUD ─────────────────────────────────────
const parametreListele = async (req, res, next) => {
  try {
    const parametreler = await EhgbParametre.find().sort({ yil: -1 });
    res.json({ success: true, data: parametreler });
  } catch (err) { next(err); }
};

const parametreGetir = async (req, res, next) => {
  try {
    const { yil } = req.params;
    const p = await EhgbParametre.findOne({ yil: parseInt(yil) });
    if (!p) return res.status(404).json({ success: false, message: `${yil} yılı parametresi bulunamadı` });
    res.json({ success: true, data: p });
  } catch (err) { next(err); }
};

const parametreKaydet = async (req, res, next) => {
  try {
    const { yil, aciklama, parametreler } = req.body;
    const mevcut = await EhgbParametre.findOne({ yil });
    if (mevcut) {
      mevcut.aciklama = aciklama;
      mevcut.parametreler = parametreler || {};
      mevcut.guncelleme_tarihi = new Date();
      await mevcut.save();
      res.json({ success: true, data: mevcut });
    } else {
      const yeni = await EhgbParametre.create({ yil, aciklama, parametreler: parametreler || {} });
      res.status(201).json({ success: true, data: yeni });
    }
  } catch (err) { next(err); }
};

const parametreSil = async (req, res, next) => {
  try {
    await EhgbParametre.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Hesaplamalar CRUD ─────────────────────────────────────
const hesapListele = async (req, res, next) => {
  try {
    const { isgal_id, yil, durum, sayfa = 1, limit = 20 } = req.query;
    const filtre = {};
    if (isgal_id) filtre.isgal_id = isgal_id;
    if (yil) filtre.hesaplama_yili = parseInt(yil);
    if (durum) filtre.durum = durum;
    const toplam = await EhgbHesap.countDocuments(filtre);
    const hesaplar = await EhgbHesap.find(filtre)
      .sort({ createdAt: -1 })
      .skip((sayfa - 1) * limit)
      .limit(parseInt(limit));
    res.json({ success: true, toplam, sayfa: parseInt(sayfa), data: hesaplar });
  } catch (err) { next(err); }
};

const hesapGetir = async (req, res, next) => {
  try {
    const hesap = await EhgbHesap.findById(req.params.id);
    if (!hesap) return res.status(404).json({ success: false, message: 'Hesaplama bulunamadı' });
    res.json({ success: true, data: hesap });
  } catch (err) { next(err); }
};

const hesapOlustur = async (req, res, next) => {
  try {
    const {
      isgal_id, mera_id,
      il_ad, ilce_ad, mahalle_ad, ada, parsel,
      isgalci_ad_soyad, isgalci_tc, isgalci_adres,
      isgal_alani_m2, isgal_turu, isgal_tarihi,
      karar_tarihi, aciklama,
      a_alan, b_alan, b_derinlik, c_alan, c_kalinlik, tel_orgu_m, uzaklik_km,
    } = req.body;

    const hesaplama_yili = karar_tarihi
      ? new Date(karar_tarihi).getFullYear()
      : new Date().getFullYear();

    // Yılın parametrelerini çek, yoksa varsayılan kullan
    const dbParam = await EhgbParametre.findOne({ yil: hesaplama_yili });
    const p = dbParam?.parametreler && Object.keys(dbParam.parametreler).length > 0
      ? { ...VARSAYILAN_PARAMETRELER, ...dbParam.parametreler }
      : VARSAYILAN_PARAMETRELER;

    const girdi = {
      a_alan: +a_alan || 0, b_alan: +b_alan || 0, b_derinlik: +b_derinlik || 0,
      c_alan: +c_alan || 0, c_kalinlik: +c_kalinlik || 0,
      tel_orgu_m: +tel_orgu_m || 0, uzaklik_km: +uzaklik_km || 0,
    };

    const sonuc = hesaplaEHGB(girdi, p);

    const hesap = await EhgbHesap.create({
      isgal_id: isgal_id || null, mera_id: mera_id || null,
      il_ad, ilce_ad, mahalle_ad, ada, parsel,
      isgalci_ad_soyad, isgalci_tc, isgalci_adres,
      isgal_alani_m2, isgal_turu, isgal_tarihi: isgal_tarihi || null,
      karar_tarihi, hesaplama_yili,
      kullanilan_parametreler: p,
      sonuc, toplam_bedel: sonuc.genel_toplam, aciklama,
    });

    res.status(201).json({ success: true, data: hesap });
  } catch (err) { next(err); }
};

const hesapGuncelle = async (req, res, next) => {
  try {
    const hesap = await EhgbHesap.findById(req.params.id);
    if (!hesap) return res.status(404).json({ success: false, message: 'Hesaplama bulunamadı' });

    // Alan değerleri değiştiyse yeniden hesapla
    const alanlar = ['a_alan','b_alan','b_derinlik','c_alan','c_kalinlik','tel_orgu_m','uzaklik_km'];
    const alanDegisti = alanlar.some(a => req.body[a] !== undefined);

    if (alanDegisti) {
      const girdi = {
        a_alan: +(req.body.a_alan ?? hesap.sonuc?.a_alan ?? 0),
        b_alan: +(req.body.b_alan ?? hesap.sonuc?.b_alan ?? 0),
        b_derinlik: +(req.body.b_derinlik ?? hesap.sonuc?.b_derinlik ?? 0),
        c_alan: +(req.body.c_alan ?? hesap.sonuc?.c_alan ?? 0),
        c_kalinlik: +(req.body.c_kalinlik ?? hesap.sonuc?.c_kalinlik ?? 0),
        tel_orgu_m: +(req.body.tel_orgu_m ?? hesap.sonuc?.tel_orgu_m ?? 0),
        uzaklik_km: +(req.body.uzaklik_km ?? hesap.sonuc?.uzaklik_km ?? 0),
      };
      const p = hesap.kullanilan_parametreler || VARSAYILAN_PARAMETRELER;
      const sonuc = hesaplaEHGB(girdi, p);
      hesap.sonuc = sonuc;
      hesap.toplam_bedel = sonuc.genel_toplam;
    }

    ['il_ad','ilce_ad','mahalle_ad','ada','parsel','isgalci_ad_soyad',
      'isgalci_tc','isgalci_adres','isgal_alani_m2','isgal_turu','isgal_tarihi',
      'karar_tarihi','aciklama','durum'].forEach(a => {
      if (req.body[a] !== undefined) hesap[a] = req.body[a];
    });
    if (req.body.karar_tarihi) hesap.hesaplama_yili = new Date(req.body.karar_tarihi).getFullYear();

    await hesap.save();
    res.json({ success: true, data: hesap });
  } catch (err) { next(err); }
};

const hesapSil = async (req, res, next) => {
  try {
    await EhgbHesap.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Canlı Hesaplama (kaydetmeden) ────────────────────────
const canliHesapla = async (req, res, next) => {
  try {
    const { yil, ...girdi } = req.body;
    const hesaplama_yili = yil || new Date().getFullYear();
    const dbParam = await EhgbParametre.findOne({ yil: hesaplama_yili });
    const p = dbParam?.parametreler && Object.keys(dbParam.parametreler).length > 0
      ? { ...VARSAYILAN_PARAMETRELER, ...dbParam.parametreler }
      : VARSAYILAN_PARAMETRELER;
    const sonuc = hesaplaEHGB({
      a_alan: +girdi.a_alan || 0, b_alan: +girdi.b_alan || 0,
      b_derinlik: +girdi.b_derinlik || 0, c_alan: +girdi.c_alan || 0,
      c_kalinlik: +girdi.c_kalinlik || 0, tel_orgu_m: +girdi.tel_orgu_m || 0,
      uzaklik_km: +girdi.uzaklik_km || 0,
    }, p);
    res.json({ success: true, data: sonuc, parametreler_yili: hesaplama_yili });
  } catch (err) { next(err); }
};

// ── İstatistik ────────────────────────────────────────────
const istatistik = async (req, res, next) => {
  try {
    const [toplam, taslak, kesinlesti] = await Promise.all([
      EhgbHesap.countDocuments(),
      EhgbHesap.countDocuments({ durum: 'taslak' }),
      EhgbHesap.countDocuments({ durum: 'kesinlesti' }),
    ]);
    const sonYil = new Date().getFullYear();
    const parametreMevcut = !!(await EhgbParametre.findOne({ yil: sonYil }));
    res.json({ success: true, data: { toplam, taslak, kesinlesti, parametreMevcut, sonYil } });
  } catch (err) { next(err); }
};

// ── Rapor (HTML/PDF) ─────────────────────────────────────
const rapor = async (req, res, next) => {
  try {
    const hesap = await EhgbHesap.findById(req.params.id);
    if (!hesap) return res.status(404).json({ success: false, message: 'Hesaplama bulunamadı' });
    const s = hesap.sonuc || {};
    const tarih = new Date().toLocaleDateString('tr-TR');
    const kararTarih = hesap.karar_tarihi ? new Date(hesap.karar_tarihi).toLocaleDateString('tr-TR') : '-';
    const fmt = n => n != null ? Number(n).toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0,00';
    const DURUM = { taslak:'TASLAK', kesinlesti:'KESİNLEŞMİŞ', itiraz:'İTİRAZ', iptal:'İPTAL' };

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>Eski Haline Getirme Bedeli Hesap Raporu</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;color:#222;margin:0;padding:20px}
  h1{font-size:14px;text-align:center;margin-bottom:4px}
  h2{font-size:12px;text-align:center;color:#555;margin-bottom:16px;font-weight:normal}
  .durum-damga{display:inline-block;border:3px solid ${hesap.durum==='kesinlesti'?'#0a3622':'#856404'};
    color:${hesap.durum==='kesinlesti'?'#0a3622':'#856404'};padding:4px 16px;border-radius:4px;
    font-size:13px;font-weight:bold;float:right;margin-top:-10px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  th{background:#1a6b4a;color:#fff;padding:5px 7px;text-align:left;font-size:11px}
  td{padding:4px 7px;border-bottom:1px solid #e0e0e0;vertical-align:top}
  tr:nth-child(even) td{background:#f7faf8}
  .right{text-align:right}
  .grup{background:#e8f5ee !important;font-weight:bold;color:#0a3622}
  .toplam{background:#1a6b4a !important;color:#fff;font-weight:bold;font-size:13px}
  .bilgi-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .bilgi-kart{border:1px solid #d0ddd5;border-radius:6px;padding:10px}
  .bilgi-kart h3{font-size:11px;color:#1a6b4a;margin:0 0 6px 0;border-bottom:1px solid #d0ddd5;padding-bottom:4px}
  .bilgi-satir{display:flex;gap:6px;margin-bottom:3px}
  .bilgi-etiket{color:#666;min-width:130px;font-size:10px}
  .bilgi-deger{font-weight:500}
  .aciklama-kutu{background:#fff8e1;border:1px solid #ffe082;border-radius:4px;padding:8px;margin-bottom:12px;font-size:10px}
  .imza{margin-top:40px;display:flex;justify-content:space-between}
  .imza-kutu{text-align:center;border-top:1px solid #333;padding-top:6px;width:200px}
  @media print{body{margin:0;padding:10px}}
</style>
</head>
<body>
<h1>4342 SAYILI MERA KANUNU KAPSAMINDA</h1>
<h2>ESKİ HALİNE GETİRME BEDELİ HESAP RAPORU</h2>
<span class="durum-damga">${DURUM[hesap.durum]||hesap.durum.toUpperCase()}</span>

<div class="aciklama-kutu">
  <strong>Yasal Dayanak:</strong> 4342 sayılı Mera Kanunu kapsamında hazırlanmıştır. Birim fiyatlar; piyasa fiyat araştırmaları, İl Mera Komisyonu Kararları, İBB ve OGM rayiçleri esas alınmıştır.
  Hafriyat taşıma bedeli: İBB Çevre Koruma Şube Müdürlüğü Hizmet Tarifesi esas alınmıştır.
  İnşaat/Hafriyat (B Tipi) alanlarda toprak serme + tohum/gübre bedeli 1,5 kat uygulanmıştır.
  Gübreleme: Yanmış hayvan gübresi 1 yıl; amonyum sülfat ve kompoze gübre 2 yıl uygulanır.
</div>

<div class="bilgi-grid">
  <div class="bilgi-kart">
    <h3>İşgalci Bilgileri</h3>
    <div class="bilgi-satir"><span class="bilgi-etiket">Adı Soyadı/Unvanı:</span><span class="bilgi-deger">${hesap.isgalci_ad_soyad||'-'}</span></div>
    <div class="bilgi-satir"><span class="bilgi-etiket">T.C./V.K.N.:</span><span class="bilgi-deger">${hesap.isgalci_tc||'-'}</span></div>
    <div class="bilgi-satir"><span class="bilgi-etiket">Adresi:</span><span class="bilgi-deger">${hesap.isgalci_adres||'-'}</span></div>
  </div>
  <div class="bilgi-kart">
    <h3>İşgal Edilen Yer Bilgileri</h3>
    <div class="bilgi-satir"><span class="bilgi-etiket">İl / İlçe:</span><span class="bilgi-deger">${hesap.il_ad||'-'} / ${hesap.ilce_ad||'-'}</span></div>
    <div class="bilgi-satir"><span class="bilgi-etiket">Mahalle/Köy:</span><span class="bilgi-deger">${hesap.mahalle_ad||'-'}</span></div>
    <div class="bilgi-satir"><span class="bilgi-etiket">Ada / Parsel:</span><span class="bilgi-deger">${hesap.ada||'-'} / ${hesap.parsel||'-'}</span></div>
    <div class="bilgi-satir"><span class="bilgi-etiket">Kaymakamlık Karar Tarihi:</span><span class="bilgi-deger">${kararTarih}</span></div>
    <div class="bilgi-satir"><span class="bilgi-etiket">Hesaplama Yılı:</span><span class="bilgi-deger"><strong>${hesap.hesaplama_yili}</strong></span></div>
  </div>
</div>

<div class="bilgi-kart" style="margin-bottom:12px">
  <h3>Alan Bilgileri</h3>
  <table style="width:100%">
    <tr>
      <th>Alan Tipi</th><th class="right">Alan (m²)</th><th class="right">Derinlik/Kalınlık (m)</th><th class="right">Hacim (m³)</th>
    </tr>
    ${s.a_alan>0?`<tr><td>A - Sürülen / Tarla Olarak Kullanılan Alan</td><td class="right">${s.a_alan.toLocaleString('tr-TR')}</td><td class="right">—</td><td class="right">—</td></tr>`:''}
    ${s.b_alan>0?`<tr><td>B - İnşaat / Hafriyat Dökülen Alan</td><td class="right">${s.b_alan.toLocaleString('tr-TR')}</td><td class="right">${s.b_derinlik} m</td><td class="right">${fmt(s.b_alan*s.b_derinlik)}</td></tr>`:''}
    ${s.c_alan>0?`<tr><td>C - Asfalt / Beton Kaplı Alan</td><td class="right">${s.c_alan.toLocaleString('tr-TR')}</td><td class="right">${s.c_kalinlik} m</td><td class="right">${fmt(s.c_alan*s.c_kalinlik)}</td></tr>`:''}
    <tr class="grup"><td><strong>Toplam Islah Alanı</strong></td><td class="right"><strong>${(s.toplam_alan_m2||0).toLocaleString('tr-TR')} m²</strong></td><td class="right"><strong>${fmt(s.toplam_alan_da)} da</strong></td><td class="right"><strong>${fmt(s.hacim_m3)} m³</strong></td></tr>
    ${s.tel_orgu_m>0?`<tr><td>Tel Örgü Uzunluğu</td><td class="right">${s.tel_orgu_m.toLocaleString('tr-TR')} m</td><td></td><td></td></tr>`:''}
    ${s.uzaklik_km>0?`<tr><td>Döküm Sahasına Uzaklık</td><td class="right">${s.uzaklik_km} km</td><td></td><td></td></tr>`:''}
  </table>
</div>

<h3 style="color:#1a6b4a;font-size:12px;margin-bottom:6px">İşçilik Maliyetleri</h3>
<table>
  <tr><th>İşlem Adı</th><th>Birim Fiyat</th><th>Açıklama</th><th class="right">Alan/Miktar</th><th class="right">Toplam (TL)</th></tr>
  <tr><td>Derin Sürüm (Dipkazan)</td><td>${fmt(hesap.kullanilan_parametreler?.derin_surum)} TL/da</td><td>A+B+C toplam alanı</td><td class="right">${fmt(s.toplam_alan_da)} da</td><td class="right">${fmt(s.derin_surum)}</td></tr>
  <tr><td>Sürüm (Pulluk)</td><td>${fmt(hesap.kullanilan_parametreler?.surum_pulluk)} TL/da</td><td>A+B+C toplam alanı</td><td class="right">${fmt(s.toplam_alan_da)} da</td><td class="right">${fmt(s.surum_pulluk)}</td></tr>
  <tr><td>İkileme (Kazayağı-Diskarrow)</td><td>${fmt(hesap.kullanilan_parametreler?.ikilem)} TL/da</td><td>A+B+C toplam alanı</td><td class="right">${fmt(s.toplam_alan_da)} da</td><td class="right">${fmt(s.ikilem)}</td></tr>
  <tr><td>Tırmık</td><td>${fmt(hesap.kullanilan_parametreler?.tirmik)} TL/da</td><td>A+B+C toplam alanı</td><td class="right">${fmt(s.toplam_alan_da)} da</td><td class="right">${fmt(s.tirmik)}</td></tr>
  <tr><td>Gübreleme (Makineli – 2 yıl)</td><td>${fmt(hesap.kullanilan_parametreler?.gubreleme)} TL/da</td><td>A+B+C toplam alanı</td><td class="right">${fmt(s.toplam_alan_da)} da</td><td class="right">${fmt(s.gubreleme_isc)}</td></tr>
  <tr><td>Ekim (Mibzerle – 2 yıl)</td><td>${fmt(hesap.kullanilan_parametreler?.ekim)} TL/da</td><td>A+B+C toplam alanı</td><td class="right">${fmt(s.toplam_alan_da)} da</td><td class="right">${fmt(s.ekim_isc)}</td></tr>
  <tr><td>Temizlik / Tesviye</td><td>${fmt(hesap.kullanilan_parametreler?.temizlik_tesviye)} TL/da</td><td>A+B+C toplam alanı</td><td class="right">${fmt(s.toplam_alan_da)} da</td><td class="right">${fmt(s.temizlik)}</td></tr>
  ${s.hafriyat_toplam>0?`
  <tr class="grup"><td colspan="4">Hafriyat Taşıma (B+C tipi alanlar)</td><td class="right">${fmt(s.hafriyat_toplam)}</td></tr>
  <tr><td style="padding-left:20px">↳ Yükleme İşçiliği (${fmt(s.sefer_sayisi)} sefer × ${fmt(s.hafriyat_iscilik/s.sefer_sayisi||0)} TL)</td><td colspan="2">Araç kap: ${hesap.kullanilan_parametreler?.arac_kapasite_m3} m³, özgül ağırlık: ${hesap.kullanilan_parametreler?.ozgul_agirlik} kg/m³</td><td class="right">${fmt(s.sefer_sayisi)} sefer</td><td class="right">${fmt(s.hafriyat_iscilik)}</td></tr>
  <tr><td style="padding-left:20px">↳ Nakliye (${s.uzaklik_km} km × 2 yön)</td><td colspan="2">${hesap.kullanilan_parametreler?.nakliye_km} TL/km tek yön</td><td class="right">${fmt(s.sefer_sayisi)} sefer</td><td class="right">${fmt(s.hafriyat_nakliye)}</td></tr>
  <tr><td style="padding-left:20px">↳ Depolama Sahası Giriş Ücreti</td><td colspan="2">${fmt(hesap.kullanilan_parametreler?.depolama_giris)} TL/araç</td><td class="right">${fmt(s.sefer_sayisi)} araç</td><td class="right">${fmt(s.hafriyat_depolama)}</td></tr>`:''}
  ${s.toprak_serme>0?`<tr><td>Toprak Serme (B+C alanı)</td><td>${fmt(hesap.kullanilan_parametreler?.toprak_serme)} TL/da</td><td>Yalnızca B+C tipi alanlar için</td><td class="right">${fmt(s.bc_alan_da)} da</td><td class="right">${fmt(s.toprak_serme)}</td></tr>`:''}
  ${s.asfalt_sokum>0?`<tr><td>Asfalt/Beton Sökümü</td><td>${fmt(hesap.kullanilan_parametreler?.asfalt_sokum)} TL/m³</td><td>Yalnızca C tipi alan</td><td class="right">${fmt(s.asfalt_m3)} m³</td><td class="right">${fmt(s.asfalt_sokum)}</td></tr>`:''}
  ${s.tel_orgu_bedel>0?`<tr><td>Tel Örgü Kaldırılması ve Sınır Düzenleme</td><td>${fmt(hesap.kullanilan_parametreler?.tel_orgu)} TL/m</td><td>—</td><td class="right">${s.tel_orgu_m} m</td><td class="right">${fmt(s.tel_orgu_bedel)}</td></tr>`:''}
  <tr class="grup"><td colspan="4"><strong>İşçilik Toplam</strong></td><td class="right"><strong>${fmt(s.iscilik_toplam)}</strong></td></tr>
</table>

<h3 style="color:#1a6b4a;font-size:12px;margin-bottom:6px">Tohum Maliyetleri</h3>
<table>
  <tr><th>Bitki Adı</th><th class="right">Oran</th><th class="right">Miktar (kg/da)</th><th class="right">Birim Fiyat (TL/kg)</th><th class="right">Toplam (TL)</th></tr>
  ${(s.tohum_detay||[]).map(t=>`<tr><td>${t.ad}</td><td class="right">%${(t.oran*100).toFixed(0)}</td><td class="right">${t.miktar_da.toFixed(2)}</td><td class="right">${fmt(t.fiyat)}</td><td class="right">${fmt(t.maliyet)}</td></tr>`).join('')}
  <tr class="grup"><td colspan="4"><strong>Tohum Toplam (${fmt(s.toplam_alan_da)} da)</strong></td><td class="right"><strong>${fmt(s.tohum_toplam)}</strong></td></tr>
</table>

<h3 style="color:#1a6b4a;font-size:12px;margin-bottom:6px">Gübreleme Maliyetleri</h3>
<table>
  <tr><th>Gübre Adı</th><th>Uygulama</th><th class="right">Birim Fiyat (TL/kg)</th><th class="right">Miktar (kg/da)</th><th class="right">Toplam (TL)</th></tr>
  <tr><td>Amonyum Sülfat %21 N</td><td>2 yıl</td><td class="right">${fmt(hesap.kullanilan_parametreler?.amonyum_sulfat_fiyat)}</td><td class="right">${hesap.kullanilan_parametreler?.amonyum_sulfat_miktar}</td><td class="right">${fmt(s.amonyum_m)}</td></tr>
  <tr><td>Yanmış Hayvan Gübresi</td><td>1 yıl</td><td class="right">${fmt(hesap.kullanilan_parametreler?.hayvan_gubres_fiyat)}</td><td class="right">${hesap.kullanilan_parametreler?.hayvan_gubres_miktar}</td><td class="right">${fmt(s.hayvan_m)}</td></tr>
  <tr><td>Kompoze Gübre 20-20-0</td><td>2 yıl</td><td class="right">${fmt(hesap.kullanilan_parametreler?.kompoze_fiyat)}</td><td class="right">${hesap.kullanilan_parametreler?.kompoze_miktar}</td><td class="right">${fmt(s.kompoze_m)}</td></tr>
  <tr class="grup"><td colspan="4"><strong>Gübre Toplam (${fmt(s.toplam_alan_da)} da)</strong></td><td class="right"><strong>${fmt(s.gubre_toplam)}</strong></td></tr>
</table>

<table>
  <tr><th style="font-size:13px">KATEGORİ</th><th class="right" style="font-size:13px">TUTAR (TL)</th></tr>
  <tr><td>İşçilik Toplam</td><td class="right">${fmt(s.iscilik_toplam)}</td></tr>
  <tr><td>Tohum Toplam</td><td class="right">${fmt(s.tohum_toplam)}</td></tr>
  <tr><td>Gübreleme Toplam</td><td class="right">${fmt(s.gubre_toplam)}</td></tr>
  <tr class="toplam"><td>ESKİ HALİNE GETİRME BEDELİ TOPLAMI</td><td class="right">${fmt(hesap.toplam_bedel)} TL</td></tr>
</table>

<p style="font-size:10px;color:#666;margin-top:8px">
  * Yukarıda hesaplanan bedel, 4342 sayılı Mera Kanunu'nun ilgili hükümleri çerçevesinde mera alanının eski haline getirilmesi amacıyla köy sandığına veya belediye bütçesinde ayrı bir hesaba yatırılacaktır.
</p>

<div class="imza">
  <div class="imza-kutu">Tarih: ${tarih}<br><br>HAZIRLAYAN</div>
  <div class="imza-kutu">ONAYLAYAN</div>
</div>

<script>window.print();<\/script>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
};

module.exports = {
  parametreListele, parametreGetir, parametreKaydet, parametreSil,
  hesapListele, hesapGetir, hesapOlustur, hesapGuncelle, hesapSil,
  canliHesapla, istatistik, rapor,
};
