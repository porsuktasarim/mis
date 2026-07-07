const Tahsis  = require('./tahsis.model');
const Mera    = require('../mera/mera.model');

// ── Liste ─────────────────────────────────────────────────
const listele = async (req, res, next) => {
  try {
    const { durum, il_ad, ilce_ad, mahalle_ad, ara, sayfa = 1, limit = 20 } = req.query;
    const filtre = {};
    if (durum)      filtre.durum    = durum;
    if (il_ad)      filtre.il_ad    = { $regex: il_ad,    $options: 'i' };
    if (ilce_ad)    filtre.ilce_ad  = { $regex: ilce_ad,  $options: 'i' };
    if (mahalle_ad) filtre.mahalle_ad = { $regex: mahalle_ad, $options: 'i' };
    if (ara) {
      filtre.$or = [
        { tahsis_no:   { $regex: ara, $options: 'i' } },
        { talep_sahibi:{ $regex: ara, $options: 'i' } },
        { il_ad:       { $regex: ara, $options: 'i' } },
      ];
    }
    const skip  = (parseInt(sayfa) - 1) * parseInt(limit);
    const total = await Tahsis.countDocuments(filtre);
    const data  = await Tahsis.find(filtre)
      .sort({ createdAt: -1 })
      .skip(skip).limit(parseInt(limit))
      .select('-adimlar -notlar -parseller');
    res.json({ success: true, total, sayfa: parseInt(sayfa), data });
  } catch (err) { next(err); }
};

// ── Tekil getir ───────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const kayit = await Tahsis.findById(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });
    res.json({ success: true, data: kayit });
  } catch (err) { next(err); }
};

// ── Oluştur ───────────────────────────────────────────────
const olustur = async (req, res, next) => {
  try {
    const { il_ad, ilce_ad, mahalle_ad, talep_sahibi, talep_tarihi, talep_amaci, aciklama } = req.body;
    if (!il_ad) return res.status(400).json({ success: false, message: 'İl zorunlu' });

    const tahsis = await Tahsis.create({
      il_ad, ilce_ad, mahalle_ad,
      talep_sahibi, talep_tarihi, talep_amaci, aciklama,
      durum: 'taslak',
      aktif_adim: 'basvuru',
    });
    res.status(201).json({ success: true, data: tahsis });
  } catch (err) { next(err); }
};

// ── Güncelle ──────────────────────────────────────────────
const guncelle = async (req, res, next) => {
  try {
    const tahsis = await Tahsis.findById(req.params.id);
    if (!tahsis) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });

    const alanlar = ['il_ad','ilce_ad','mahalle_ad','talep_sahibi','talep_tarihi',
                     'talep_amaci','durum','aktif_adim','aciklama'];
    alanlar.forEach(a => { if (req.body[a] !== undefined) tahsis[a] = req.body[a]; });

    await tahsis.save();
    res.json({ success: true, data: tahsis });
  } catch (err) { next(err); }
};

// ── Sil ───────────────────────────────────────────────────
const sil = async (req, res, next) => {
  try {
    const kayit = await Tahsis.findByIdAndDelete(req.params.id);
    if (!kayit) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });
    res.json({ success: true, message: 'Silindi' });
  } catch (err) { next(err); }
};

// ── Parselleri Yükle (mahalle bazlı mera sorgusundan) ────
const parsellerYukle = async (req, res, next) => {
  try {
    const tahsis = await Tahsis.findById(req.params.id);
    if (!tahsis) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });

    const { secili_mera_idler } = req.body;
    const mevcutIdler = new Set(tahsis.parseller.map(p => String(p.mera_id)));

    let meralar;
    if (secili_mera_idler && secili_mera_idler.length > 0) {
      meralar = await Mera.find({ _id: { $in: secili_mera_idler } })
        .select('il_ad ilce_ad mahalle_ad ada parsel tapu_alani_da vasif kaynak durum');
    } else {
      const filtre = {};
      if (tahsis.il_ad)      filtre.il_ad      = tahsis.il_ad;
      if (tahsis.ilce_ad)    filtre.ilce_ad    = tahsis.ilce_ad;
      if (tahsis.mahalle_ad) filtre.mahalle_ad = tahsis.mahalle_ad;
      meralar = await Mera.find(filtre)
        .select('il_ad ilce_ad mahalle_ad ada parsel tapu_alani_da vasif kaynak durum')
        .sort({ ada: 1, parsel: 1 });
    }

    const yeniParseller = meralar
      .filter(m => !mevcutIdler.has(String(m._id)))
      .map(m => ({
        mera_id: m._id, il_ad: m.il_ad, ilce_ad: m.ilce_ad,
        mahalle_ad: m.mahalle_ad, ada: m.ada, parsel: m.parsel,
        tapu_alani_da: m.tapu_alani_da, vasif: m.vasif, kaynak: m.kaynak, dahil: true,
      }));

    tahsis.parseller.push(...yeniParseller);
    await tahsis.save();
    res.json({ success: true, eklenen: yeniParseller.length, toplam: tahsis.parseller.length, data: tahsis.parseller });
  } catch (err) { next(err); }
};

// ── Parsel güncelle (dahil/hariç, açıklama) ─────────────
const parselGuncelle = async (req, res, next) => {
  try {
    const tahsis = await Tahsis.findById(req.params.id);
    if (!tahsis) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });

    const parsel = tahsis.parseller.id(req.params.parsel_id);
    if (!parsel) return res.status(404).json({ success: false, message: 'Parsel bulunamadı' });

    if (req.body.dahil !== undefined) parsel.dahil = req.body.dahil;
    if (req.body.aciklama !== undefined) parsel.aciklama = req.body.aciklama;

    await tahsis.save();
    res.json({ success: true, data: tahsis.parseller });
  } catch (err) { next(err); }
};

// ── Parsel sil ────────────────────────────────────────────
const parselSil = async (req, res, next) => {
  try {
    const tahsis = await Tahsis.findById(req.params.id);
    if (!tahsis) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });
    tahsis.parseller = tahsis.parseller.filter(p => String(p._id) !== String(req.params.parsel_id));
    await tahsis.save();
    res.json({ success: true, data: tahsis.parseller });
  } catch (err) { next(err); }
};

// ── BBHB bağlantısı ekle ─────────────────────────────────
const bbhbEkle = async (req, res, next) => {
  try {
    const tahsis = await Tahsis.findById(req.params.id);
    if (!tahsis) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });

    const { bbhb_id, toplam_bbhb, toplam_adet, il, ilce, mahalle, tarih, aciklama } = req.body;
    tahsis.bbhb_baglantilari.push({ bbhb_id, toplam_bbhb, toplam_adet, il, ilce, mahalle, tarih, aciklama });
    await tahsis.save();
    res.json({ success: true, data: tahsis.bbhb_baglantilari });
  } catch (err) { next(err); }
};

// ── BBHB bağlantısı sil ──────────────────────────────────
const bbhbSil = async (req, res, next) => {
  try {
    const tahsis = await Tahsis.findById(req.params.id);
    if (!tahsis) return res.status(404).json({ success: false, message: 'Tahsis bulunamadı' });
    tahsis.bbhb_baglantilari = tahsis.bbhb_baglantilari.filter(b => String(b._id) !== String(req.params.bbhb_bag_id));
    await tahsis.save();
    res.json({ success: true, data: tahsis.bbhb_baglantilari });
  } catch (err) { next(err); }
};

// ── Teknik bilgileri güncelle ─────────────────────────────
const teknikGuncelle = async (req, res, next) => {
  try {
    const tahsis = await Tahsis.findById(req.params.id);
    if (!tahsis) return res.status(404).json({ success: false, message: 'Bulunamadı' });
    if (req.body.teknik) {
      tahsis.teknik = { ...(tahsis.teknik?.toObject?.() || {}), ...req.body.teknik };
    }
    if (req.body.aski)      tahsis.aski      = { ...tahsis.aski?.toObject?.(),      ...req.body.aski };
    if (req.body.komisyon)  tahsis.komisyon  = { ...tahsis.komisyon?.toObject?.(),  ...req.body.komisyon };
    if (req.body.imzacilar) tahsis.imzacilar = { ...tahsis.imzacilar?.toObject?.(),...req.body.imzacilar };
    if (req.body.otlatma_haklari) tahsis.otlatma_haklari = req.body.otlatma_haklari;
    await tahsis.save();
    res.json({ success: true, data: tahsis });
  } catch (err) { next(err); }
};
const istatistik = async (req, res, next) => {
  try {
    const [toplam, durumlar] = await Promise.all([
      Tahsis.countDocuments(),
      Tahsis.aggregate([{ $group: { _id: '$durum', sayi: { $sum: 1 } } }]),
    ]);
    const durumObj = {};
    durumlar.forEach(d => { durumObj[d._id] = d.sayi; });
    res.json({ success: true, data: { toplam, durumlar: durumObj } });
  } catch (err) { next(err); }
};

module.exports = {
  listele, getById, olustur, guncelle, sil, istatistik,
  parsellerYukle, parselGuncelle, parselSil,
  bbhbEkle, bbhbSil,
  teknikGuncelle,
};
