const { EhgbParametre, EhgbHesap } = require('./ehgb.model');

// ── Parametreler (Ayarlar) ────────────────────────────────
const parametreListele = async (req, res, next) => {
  try {
    const parametreler = await EhgbParametre.find().sort({ yil: -1 });
    res.json({ success: true, data: parametreler });
  } catch (err) { next(err); }
};

const parametreGetir = async (req, res, next) => {
  try {
    const { yil } = req.params;
    const parametreler = await EhgbParametre.findOne({ yil: parseInt(yil) });
    if (!parametreler) return res.status(404).json({ success: false, message: `${yil} yılı parametresi bulunamadı` });
    res.json({ success: true, data: parametreler });
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

// ── Hesaplamalar ──────────────────────────────────────────
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
    } = req.body;

    const hesaplama_yili = karar_tarihi
      ? new Date(karar_tarihi).getFullYear()
      : new Date().getFullYear();

    // İlgili yılın parametrelerini çek
    const parametreler = await EhgbParametre.findOne({ yil: hesaplama_yili });

    // TODO: Hesaplama formülü buraya eklenecek
    const sonuc = {
      mesaj: 'Hesaplama formülü henüz tanımlanmamış. Parametreler ayarlandıktan sonra hesaplanacak.',
      hesaplama_yili,
      parametreler_mevcut: !!parametreler,
    };
    const toplam_bedel = null;

    const hesap = await EhgbHesap.create({
      isgal_id, mera_id,
      il_ad, ilce_ad, mahalle_ad, ada, parsel,
      isgalci_ad_soyad, isgalci_tc, isgalci_adres,
      isgal_alani_m2, isgal_turu, isgal_tarihi,
      karar_tarihi, hesaplama_yili,
      kullanilan_parametreler: parametreler?.parametreler || {},
      sonuc, toplam_bedel, aciklama,
    });

    res.status(201).json({ success: true, data: hesap });
  } catch (err) { next(err); }
};

const hesapGuncelle = async (req, res, next) => {
  try {
    const hesap = await EhgbHesap.findById(req.params.id);
    if (!hesap) return res.status(404).json({ success: false, message: 'Hesaplama bulunamadı' });
    const alanlar = ['il_ad','ilce_ad','mahalle_ad','ada','parsel','isgalci_ad_soyad',
      'isgalci_tc','isgalci_adres','isgal_alani_m2','isgal_turu','isgal_tarihi',
      'karar_tarihi','aciklama','durum','sonuc','toplam_bedel'];
    alanlar.forEach(a => { if (req.body[a] !== undefined) hesap[a] = req.body[a]; });
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

module.exports = {
  parametreListele, parametreGetir, parametreKaydet, parametreSil,
  hesapListele, hesapGetir, hesapOlustur, hesapGuncelle, hesapSil,
  istatistik,
};
