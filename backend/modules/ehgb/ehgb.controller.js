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

    // Ayarlardan aktif teknik ekip ve personeli çek
    const Ayarlar = require('../ayarlar/ayarlar.model');
    const ayarlar = await Ayarlar.findOne();
    const teknikEkipler = ayarlar?.teknik_ekipler || [];
    // En son yıllı ekibi bul, yoksa ilkini al
    const aktifEkip = teknikEkipler.sort((a,b)=>(b.yil||0)-(a.yil||0))[0];
    const personel = (aktifEkip?.uyeler || []).filter(u => u.aktif !== false);

    const s = hesap.sonuc || {};
    const p = hesap.kullanilan_parametreler || {};
    const tarih = new Date().toLocaleDateString('tr-TR');
    const kararTarih = hesap.karar_tarihi ? new Date(hesap.karar_tarihi).toLocaleDateString('tr-TR') : '-';
    const fmt = n => n != null ? Number(n).toLocaleString('tr-TR', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0,00';
    const DURUM = { taslak:'TASLAK (TASLAK)', kesinlesti:'KESİNLEŞMİŞ', itiraz:'İTİRAZ', iptal:'İPTAL' };
    const damgaRenk = hesap.durum === 'kesinlesti' ? '#0a3622' : '#856404';

    // İmza kutuları — personel varsa personel, yoksa genel
    const imzaKutulari = personel.length > 0
      ? personel.map(u => `
          <div class="imza-kutu">
            <div class="imza-cizgi"></div>
            <div class="imza-ad">${u.ad}</div>
            <div class="imza-unvan">${u.unvan||''}</div>
          </div>`).join('')
      : `<div class="imza-kutu"><div class="imza-cizgi"></div><div class="imza-ad">HAZIRLAYAN</div></div>
         <div class="imza-kutu"><div class="imza-cizgi"></div><div class="imza-ad">ONAYLAYAN</div></div>`;

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>Eski Haline Getirme Bedeli Hesap Raporu</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:10.5px;color:#111;background:#fff}
.sayfa{padding:16mm 14mm;min-height:297mm;position:relative}
.sayfa-1{page-break-after:always}
@media print{
  .sayfa{padding:10mm 12mm}
  .sayfa-1{page-break-after:always}
}
h1{font-size:13px;text-align:center;font-weight:bold;margin-bottom:3px;text-transform:uppercase}
h2{font-size:11px;text-align:center;color:#333;margin-bottom:14px;font-weight:normal}
.durum-damga{border:2.5px solid ${damgaRenk};color:${damgaRenk};padding:3px 14px;
  font-size:11px;font-weight:bold;display:inline-block;float:right;margin-top:-6px}
.bolum-baslik{font-size:11px;font-weight:bold;color:#1a6b4a;border-bottom:1.5px solid #1a6b4a;
  padding-bottom:3px;margin:10px 0 5px}
table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:10px}
th{background:#1a6b4a;color:#fff;padding:4px 6px;text-align:left;font-weight:bold}
td{padding:3px 6px;border-bottom:1px solid #e0e0e0}
tr:nth-child(even) td{background:#f5faf6}
.r{text-align:right}
.c{text-align:center}
.grup td{background:#dff0e8 !important;font-weight:bold;color:#0a3622}
.ara-toplam td{background:#c8e6d8 !important;font-weight:bold}
.genel-toplam td{background:#1a6b4a !important;color:#fff;font-weight:bold;font-size:12px}
.bilgi-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.bilgi-kart{border:1px solid #ccd8cc;border-radius:4px;padding:8px}
.bilgi-kart-baslik{font-size:10.5px;font-weight:bold;color:#1a6b4a;border-bottom:1px solid #ccd8cc;
  padding-bottom:4px;margin-bottom:6px}
.bilgi-satir{display:flex;gap:4px;margin-bottom:2px;font-size:10px}
.etiket{color:#555;min-width:135px}
.deger{font-weight:500}
/* İmzalar */
.imza-alani{margin-top:30px;display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px}
.imza-kutu{text-align:center;min-width:120px}
.imza-cizgi{border-top:1px solid #333;margin-bottom:5px;width:100%}
.imza-ad{font-weight:bold;font-size:10px}
.imza-unvan{font-size:9px;color:#444}
/* Sayfa 2 */
.aciklama-kutu{border:1px solid #ccd8cc;border-radius:4px;padding:10px;margin-bottom:10px;background:#fafff8}
.aciklama-baslik{font-weight:bold;color:#1a6b4a;margin-bottom:5px;font-size:11px}
.formul-satir{font-family:monospace;background:#f0f4f0;border:1px solid #dde;padding:6px 8px;
  border-radius:3px;margin:4px 0;font-size:10px;white-space:pre-wrap}
.parametre-tablo td{padding:3px 6px;border-bottom:1px solid #eee}
</style>
</head>
<body>

<!-- ═══════════════ 1. SAYFA: HESAPLAMALAR ═══════════════ -->
<div class="sayfa sayfa-1">

<h1>4342 Sayılı Mera Kanunu Kapsamında</h1>
<h2>Eski Haline Getirme Bedeli Hesap Raporu</h2>
<span class="durum-damga">${DURUM[hesap.durum]||hesap.durum.toUpperCase()}</span>

<div class="bilgi-grid">
  <div class="bilgi-kart">
    <div class="bilgi-kart-baslik">İşgalci Bilgileri</div>
    <div class="bilgi-satir"><span class="etiket">Adı Soyadı / Unvanı:</span><span class="deger">${hesap.isgalci_ad_soyad||'-'}</span></div>
    <div class="bilgi-satir"><span class="etiket">T.C. Kimlik / V.K.N.:</span><span class="deger">${hesap.isgalci_tc||'-'}</span></div>
    <div class="bilgi-satir"><span class="etiket">Adresi:</span><span class="deger">${hesap.isgalci_adres||'-'}</span></div>
  </div>
  <div class="bilgi-kart">
    <div class="bilgi-kart-baslik">İşgal Edilen Yer Bilgileri</div>
    <div class="bilgi-satir"><span class="etiket">İl / İlçe:</span><span class="deger">${hesap.il_ad||'-'} / ${hesap.ilce_ad||'-'}</span></div>
    <div class="bilgi-satir"><span class="etiket">Mahalle / Köy:</span><span class="deger">${hesap.mahalle_ad||'-'}</span></div>
    <div class="bilgi-satir"><span class="etiket">Ada / Parsel:</span><span class="deger">${hesap.ada||'-'} / ${hesap.parsel||'-'}</span></div>
    <div class="bilgi-satir"><span class="etiket">Kaymakamlık Karar Tarihi:</span><span class="deger">${kararTarih}</span></div>
    <div class="bilgi-satir"><span class="etiket">Hesaplama Yılı:</span><span class="deger"><strong>${hesap.hesaplama_yili}</strong></span></div>
  </div>
</div>

<div class="bilgi-kart" style="margin-bottom:10px">
  <div class="bilgi-kart-baslik">Alan Bilgileri</div>
  <table>
    <tr><th>Alan Tipi</th><th class="r">Alan (m²)</th><th class="r">Derinlik / Kalınlık</th><th class="r">Hafriyat Hacmi (m³)</th></tr>
    ${s.a_alan>0?`<tr><td>A — Sürülen / Tarla Olarak Kullanılan Alan</td><td class="r">${(s.a_alan||0).toLocaleString('tr-TR')}</td><td class="r">—</td><td class="r">—</td></tr>`:''}
    ${s.b_alan>0?`<tr><td>B — İnşaat / Hafriyat Dökülen Alan</td><td class="r">${(s.b_alan||0).toLocaleString('tr-TR')}</td><td class="r">${s.b_derinlik} m</td><td class="r">${fmt(s.b_alan*s.b_derinlik)}</td></tr>`:''}
    ${s.c_alan>0?`<tr><td>C — Asfalt / Beton Kaplı Alan</td><td class="r">${(s.c_alan||0).toLocaleString('tr-TR')}</td><td class="r">${s.c_kalinlik} m</td><td class="r">${fmt(s.c_alan*s.c_kalinlik)}</td></tr>`:''}
    <tr class="grup"><td><strong>Toplam Islah Alanı</strong></td><td class="r"><strong>${(s.toplam_alan_m2||0).toLocaleString('tr-TR')} m²</strong></td><td class="r"><strong>${fmt(s.toplam_alan_da)} da</strong></td><td class="r"><strong>${fmt(s.hacim_m3)} m³</strong></td></tr>
    ${s.tel_orgu_m>0?`<tr><td>Tel Örgü Uzunluğu</td><td class="r">${s.tel_orgu_m} m</td><td class="r">—</td><td class="r">—</td></tr>`:''}
    ${s.uzaklik_km>0?`<tr><td>Döküm Sahasına Uzaklık</td><td class="r">${s.uzaklik_km} km</td><td class="r">—</td><td class="r">—</td></tr>`:''}
  </table>
</div>

<div class="bolum-baslik">İşçilik Maliyetleri</div>
<table>
  <tr><th>İşlem Adı</th><th class="r">Birim Fiyat</th><th class="r">Alan / Miktar</th><th class="r">Toplam (TL)</th></tr>
  <tr><td>Derin Sürüm (Dipkazan)</td><td class="r">${fmt(p.derin_surum)} TL/da</td><td class="r">${fmt(s.toplam_alan_da)} da</td><td class="r">${fmt(s.derin_surum)}</td></tr>
  <tr><td>Sürüm (Pulluk)</td><td class="r">${fmt(p.surum_pulluk)} TL/da</td><td class="r">${fmt(s.toplam_alan_da)} da</td><td class="r">${fmt(s.surum_pulluk)}</td></tr>
  <tr><td>İkileme (Kazayağı-Diskarrow)</td><td class="r">${fmt(p.ikilem)} TL/da</td><td class="r">${fmt(s.toplam_alan_da)} da</td><td class="r">${fmt(s.ikilem)}</td></tr>
  <tr><td>Tırmık</td><td class="r">${fmt(p.tirmik)} TL/da</td><td class="r">${fmt(s.toplam_alan_da)} da</td><td class="r">${fmt(s.tirmik)}</td></tr>
  <tr><td>Gübreleme — Makineli (2 yıl)</td><td class="r">${fmt(p.gubreleme)} TL/da</td><td class="r">${fmt(s.toplam_alan_da)} da</td><td class="r">${fmt(s.gubreleme_isc)}</td></tr>
  <tr><td>Ekim — Mibzerle (2 yıl)</td><td class="r">${fmt(p.ekim)} TL/da</td><td class="r">${fmt(s.toplam_alan_da)} da</td><td class="r">${fmt(s.ekim_isc)}</td></tr>
  <tr><td>Temizlik / Tesviye</td><td class="r">${fmt(p.temizlik_tesviye)} TL/da</td><td class="r">${fmt(s.toplam_alan_da)} da</td><td class="r">${fmt(s.temizlik)}</td></tr>
  ${s.hafriyat_toplam>0?`
  <tr class="ara-toplam"><td colspan="3">Hafriyat Taşıma (B+C tipi alanlar — toplam ${fmt(s.hacim_m3)} m³, ${fmt(s.sefer_sayisi)} sefer)</td><td class="r">${fmt(s.hafriyat_toplam)}</td></tr>
  <tr><td style="padding-left:18px">↳ Yükleme İşçiliği</td><td class="r">${fmt(s.hafriyat_iscilik/Math.max(s.sefer_sayisi,1))} TL/sefer</td><td class="r">${fmt(s.sefer_sayisi)} sefer</td><td class="r">${fmt(s.hafriyat_iscilik)}</td></tr>
  <tr><td style="padding-left:18px">↳ Nakliye (${s.uzaklik_km} km × 2 yön)</td><td class="r">${fmt(p.nakliye_km)} TL/km</td><td class="r">${fmt(s.sefer_sayisi)} sefer</td><td class="r">${fmt(s.hafriyat_nakliye)}</td></tr>
  <tr><td style="padding-left:18px">↳ Depolama Sahası Giriş</td><td class="r">${fmt(p.depolama_giris)} TL/araç</td><td class="r">${fmt(s.sefer_sayisi)} araç</td><td class="r">${fmt(s.hafriyat_depolama)}</td></tr>`:''}
  ${s.toprak_serme>0?`<tr><td>Toprak Serme (yalnızca B+C alanı)</td><td class="r">${fmt(p.toprak_serme)} TL/da</td><td class="r">${fmt(s.bc_alan_da)} da</td><td class="r">${fmt(s.toprak_serme)}</td></tr>`:''}
  ${s.asfalt_sokum>0?`<tr><td>Asfalt / Beton Sökümü (yalnızca C alanı)</td><td class="r">${fmt(p.asfalt_sokum)} TL/m³</td><td class="r">${fmt(s.asfalt_m3)} m³</td><td class="r">${fmt(s.asfalt_sokum)}</td></tr>`:''}
  ${s.tel_orgu_bedel>0?`<tr><td>Tel Örgü Kaldırılması ve Sınır Düzenleme</td><td class="r">${fmt(p.tel_orgu)} TL/m</td><td class="r">${s.tel_orgu_m} m</td><td class="r">${fmt(s.tel_orgu_bedel)}</td></tr>`:''}
  <tr class="grup"><td colspan="3"><strong>İşçilik Toplam</strong></td><td class="r"><strong>${fmt(s.iscilik_toplam)}</strong></td></tr>
</table>

<div class="bilgi-grid" style="margin-top:4px">
  <div>
    <div class="bolum-baslik">Tohum Maliyetleri</div>
    <table>
      <tr><th>Bitki Adı</th><th class="r">Oran</th><th class="r">kg/da</th><th class="r">TL/kg</th><th class="r">Toplam</th></tr>
      ${(s.tohum_detay||[]).map(t=>`<tr><td>${t.ad}</td><td class="r">%${(t.oran*100).toFixed(0)}</td><td class="r">${t.miktar_da.toFixed(2)}</td><td class="r">${fmt(t.fiyat)}</td><td class="r">${fmt(t.maliyet)}</td></tr>`).join('')}
      <tr class="grup"><td colspan="4"><strong>Tohum Toplam (${fmt(s.toplam_alan_da)} da)</strong></td><td class="r"><strong>${fmt(s.tohum_toplam)}</strong></td></tr>
    </table>
  </div>
  <div>
    <div class="bolum-baslik">Gübreleme Maliyetleri</div>
    <table>
      <tr><th>Gübre</th><th class="c">Yıl</th><th class="r">TL/kg</th><th class="r">kg/da</th><th class="r">Toplam</th></tr>
      <tr><td>Amonyum Sülfat %21 N</td><td class="c">2</td><td class="r">${fmt(p.amonyum_sulfat_fiyat)}</td><td class="r">${p.amonyum_sulfat_miktar}</td><td class="r">${fmt(s.amonyum_m)}</td></tr>
      <tr><td>Yanmış Hayvan Gübresi</td><td class="c">1</td><td class="r">${fmt(p.hayvan_gubres_fiyat)}</td><td class="r">${p.hayvan_gubres_miktar}</td><td class="r">${fmt(s.hayvan_m)}</td></tr>
      <tr><td>Kompoze Gübre 20-20-0</td><td class="c">2</td><td class="r">${fmt(p.kompoze_fiyat)}</td><td class="r">${p.kompoze_miktar}</td><td class="r">${fmt(s.kompoze_m)}</td></tr>
      <tr class="grup"><td colspan="4"><strong>Gübre Toplam (${fmt(s.toplam_alan_da)} da)</strong></td><td class="r"><strong>${fmt(s.gubre_toplam)}</strong></td></tr>
    </table>
  </div>
</div>

<table style="margin-top:6px">
  <tr><th colspan="2" style="font-size:11px;text-align:center">ÖZET</th></tr>
  <tr><td style="width:70%">İşçilik Toplam</td><td class="r">${fmt(s.iscilik_toplam)} TL</td></tr>
  <tr><td>Tohum Toplam</td><td class="r">${fmt(s.tohum_toplam)} TL</td></tr>
  <tr><td>Gübreleme Toplam</td><td class="r">${fmt(s.gubre_toplam)} TL</td></tr>
  <tr class="genel-toplam"><td><strong>ESKİ HALİNE GETİRME BEDELİ TOPLAMI</strong></td><td class="r"><strong>${fmt(hesap.toplam_bedel)} TL</strong></td></tr>
</table>

<p style="font-size:9.5px;color:#555;margin:8px 0 20px;line-height:1.5">
  Yukarıda hesaplanan bedel, 4342 sayılı Mera Kanunu'nun ilgili hükümleri çerçevesinde mera alanının eski haline getirilmesi amacıyla köy sandığına veya belediye bütçesinde ayrı bir hesaba yatırılacaktır.
</p>

<div style="font-size:9.5px;margin-bottom:8px"><strong>Tarih:</strong> ${tarih}${aktifEkip?.ad ? ` &nbsp;|&nbsp; <strong>Teknik Ekip:</strong> ${aktifEkip.ad}${aktifEkip.yil?' ('+aktifEkip.yil+')':''}` : ''}</div>

<div class="imza-alani">
  ${imzaKutulari}
</div>

</div><!-- /sayfa-1 -->


<!-- ═══════════════ 2. SAYFA: AÇIKLAMALAR & FORMÜLLER ═══════════════ -->
<div class="sayfa">

<h1>Eki — Hesaplama Yöntemi ve Birim Fiyatlar</h1>
<h2 style="margin-bottom:14px">Eski Haline Getirme Bedeli — ${hesap.hesaplama_yili} Yılı</h2>

<div class="aciklama-kutu">
  <div class="aciklama-baslik">Yasal Dayanak ve Genel Açıklamalar</div>
  <p style="line-height:1.6;margin-bottom:6px">
    Bu hesap raporu, 4342 sayılı Mera Kanunu kapsamında haksız işgal edilen mera alanlarının eski haline getirilmesi amacıyla tahakkuk ettirilecek bedeli belirlemek üzere hazırlanmıştır.
  </p>
  <ul style="line-height:1.8;padding-left:16px">
    <li>Birim fiyatlar; piyasa fiyat araştırmaları, İl Mera Komisyonu Kararları, İBB ve OGM rayiçleri esas alınarak belirlenmiştir.</li>
    <li>Hafriyat taşıma bedeli, İBB Çevre Koruma Şube Müdürlüğü Hizmet Tarifesi esas alınmıştır.</li>
    <li>İnşaat/Hafriyat (B Tipi) alanlarda toprak serme + tohum/gübre bedeli 1,5 kat olarak uygulanmıştır. Hesaplamada serilecek toprak yüksekliği 20 cm olarak alınmıştır.</li>
    <li>Gübreleme: Yanmış hayvan gübresi 1 yıl; amonyum sülfat ve kompoze gübre 2 yıl uygulanır.</li>
    <li>Tohum bedeli ve gübreleme bedeli tüm ıslah alanına (A+B+C) uygulanmıştır.</li>
  </ul>
</div>

<div class="aciklama-kutu">
  <div class="aciklama-baslik">Alan Tipleri</div>
  <table class="parametre-tablo">
    <tr><th style="width:60px">Tip</th><th>Açıklama</th><th>Uygulanan İşlemler</th></tr>
    <tr><td><strong>A</strong></td><td>Sürülen / Tarla Olarak Kullanılan Alan</td><td>İşçilik + Tohum + Gübre</td></tr>
    <tr><td><strong>B</strong></td><td>İnşaat / Hafriyat Dökülen Alan</td><td>İşçilik + Hafriyat Taşıma + Toprak Serme (1,5x) + Tohum + Gübre</td></tr>
    <tr><td><strong>C</strong></td><td>Asfalt / Beton Kaplı Alan</td><td>İşçilik + Asfalt Sökümü + Hafriyat Taşıma + Toprak Serme (1,5x) + Tohum + Gübre</td></tr>
  </table>
</div>

<div class="aciklama-kutu">
  <div class="aciklama-baslik">Hafriyat Taşıma Hesaplama Formülleri</div>
  <p style="margin-bottom:6px"><strong>Hafriyat Hacmi (m³):</strong></p>
  <div class="formul-satir">Hacim = (B Alanı × B Derinliği) + (C Alanı × C Kalınlığı)</div>
  <p style="margin:6px 0"><strong>Sefer Sayısı:</strong></p>
  <div class="formul-satir">Sefer = Hafriyat Hacmi (m³) / Araç Kapasitesi (${p.arac_kapasite_m3||14} m³)</div>
  <p style="margin:6px 0"><strong>Yükleme İşçiliği:</strong></p>
  <div class="formul-satir">Araç Yükü (kg) = Araç Kapasitesi × Özgül Ağırlık = ${p.arac_kapasite_m3||14} × ${p.ozgul_agirlik||1600} = ${(p.arac_kapasite_m3||14)*(p.ozgul_agirlik||1600)} kg
İlave Torba = (Araç Yükü − 1.200 kg) / ${p.torba_kg||60} kg
Sefer Başı İşçilik = ${fmt(p.yukleme_baz||162)} TL + (İlave Torba × ${fmt(p.yukleme_ilave_torba||11)} TL)
Toplam Yükleme = Sefer Başı İşçilik × Sefer Sayısı</div>
  <p style="margin:6px 0"><strong>Nakliye:</strong></p>
  <div class="formul-satir">Nakliye = Sefer Sayısı × ${fmt(p.nakliye_km||5)} TL/km × Araç Kapasitesi × 2 (gidiş-dönüş) × Uzaklık (km)</div>
  <p style="margin:6px 0"><strong>Depolama Sahası Giriş:</strong></p>
  <div class="formul-satir">Depolama Giriş = Sefer Sayısı × ${fmt(p.depolama_giris||5771)} TL/araç</div>
</div>

<div class="aciklama-kutu">
  <div class="aciklama-baslik">Tohum Karışımı</div>
  <table class="parametre-tablo">
    <tr><th>Bitki Adı</th><th class="r">Oran (%)</th><th class="r">Miktar (kg/da)</th><th class="r">Birim Fiyat (TL/kg)</th><th class="r">Maliyet (TL/da)</th></tr>
    ${(p.tohumlar||[]).map(t=>`<tr><td>${t.ad}</td><td class="r">%${(t.oran*100).toFixed(0)}</td><td class="r">${(t.oran*(p.tohum_miktar_da||12)).toFixed(2)}</td><td class="r">${fmt(t.fiyat)}</td><td class="r">${fmt(t.oran*(p.tohum_miktar_da||12)*t.fiyat)}</td></tr>`).join('')}
    <tr class="grup"><td colspan="2"><strong>Toplam</strong></td><td class="r"><strong>${p.tohum_miktar_da||12} kg/da</strong></td><td></td><td class="r"><strong>${fmt((p.tohumlar||[]).reduce((s,t)=>s+t.oran*(p.tohum_miktar_da||12)*t.fiyat,0))} TL/da</strong></td></tr>
  </table>
</div>

<div class="aciklama-kutu">
  <div class="aciklama-baslik">${hesap.hesaplama_yili} Yılı Tüm Birim Fiyatlar</div>
  <table class="parametre-tablo">
    <tr><th>Kalem</th><th>Birim</th><th class="r">Fiyat</th><th>Kaynak</th></tr>
    <tr><td>Derin Sürüm (Dipkazan)</td><td>TL/da</td><td class="r">${fmt(p.derin_surum)}</td><td>OGM Rayiçleri / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Sürüm (Pulluk)</td><td>TL/da</td><td class="r">${fmt(p.surum_pulluk)}</td><td>OGM Rayiçleri / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>İkileme (Kazayağı-Diskarrow)</td><td>TL/da</td><td class="r">${fmt(p.ikilem)}</td><td>OGM Rayiçleri / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Tırmık</td><td>TL/da</td><td class="r">${fmt(p.tirmik)}</td><td>OGM Rayiçleri / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Gübreleme (Makineli – 2 yıl)</td><td>TL/da</td><td class="r">${fmt(p.gubreleme)}</td><td>OGM Rayiçleri / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Ekim (Mibzerle – 2 yıl)</td><td>TL/da</td><td class="r">${fmt(p.ekim)}</td><td>OGM Rayiçleri / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Temizlik / Tesviye</td><td>TL/da</td><td class="r">${fmt(p.temizlik_tesviye)}</td><td>OGM Rayiçleri / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Toprak Serme (B+C)</td><td>TL/da</td><td class="r">${fmt(p.toprak_serme)}</td><td>Piyasa / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Asfalt / Beton Sökümü</td><td>TL/m³</td><td class="r">${fmt(p.asfalt_sokum)}</td><td>KGM/18.190</td></tr>
    <tr><td>Tel Örgü Kaldırılması</td><td>TL/m</td><td class="r">${fmt(p.tel_orgu)}</td><td>KGM/70.052 – 70.053</td></tr>
    <tr><td>Hafriyat Araç Kapasitesi</td><td>m³</td><td class="r">${p.arac_kapasite_m3||14}</td><td>—</td></tr>
    <tr><td>Toprağın Özgül Ağırlığı</td><td>kg/m³</td><td class="r">${p.ozgul_agirlik||1600}</td><td>—</td></tr>
    <tr><td>Nakliye Ücreti (tek yön)</td><td>TL/km</td><td class="r">${fmt(p.nakliye_km)}</td><td>İBB Çevre Koruma Şube Müdürlüğü</td></tr>
    <tr><td>Döküm Sahası Araç Giriş Ücreti</td><td>TL/araç</td><td class="r">${fmt(p.depolama_giris)}</td><td>İBB Çevre Koruma Şube Müdürlüğü</td></tr>
    <tr><td>Yükleme İşçiliği (1.200 kg'a kadar)</td><td>TL</td><td class="r">${fmt(p.yukleme_baz)}</td><td>İBB Çevre Koruma Şube Müdürlüğü</td></tr>
    <tr><td>Yükleme İşçiliği (her 60 kg fazlası)</td><td>TL/torba</td><td class="r">${fmt(p.yukleme_ilave_torba)}</td><td>İBB Çevre Koruma Şube Müdürlüğü</td></tr>
    <tr><td>Amonyum Sülfat %21 N</td><td>TL/kg</td><td class="r">${fmt(p.amonyum_sulfat_fiyat)}</td><td>Piyasa / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Yanmış Hayvan Gübresi</td><td>TL/kg</td><td class="r">${fmt(p.hayvan_gubres_fiyat)}</td><td>Piyasa / İl Mera Komisyonu Kararları</td></tr>
    <tr><td>Kompoze Gübre 20-20-0</td><td>TL/kg</td><td class="r">${fmt(p.kompoze_fiyat)}</td><td>Piyasa / İl Mera Komisyonu Kararları</td></tr>
  </table>
</div>

</div><!-- /sayfa-2 -->

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
