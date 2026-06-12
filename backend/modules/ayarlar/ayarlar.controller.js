const Ayarlar = require('./ayarlar.model');
const VARSAYILAN = require('./ayarlar.varsayilan');
const { google } = require('googleapis');

// Ayarları getir (yoksa varsayılanları oluştur)
const getAyarlar = async (req, res, next) => {
  try {
    let ayarlar = await Ayarlar.findOne();
    if (!ayarlar) {
      ayarlar = await Ayarlar.create(VARSAYILAN);
    }
    // Drive JSON'larını maskele
    const veri = ayarlar.toObject();
    veri.drive_hesaplari = veri.drive_hesaplari.map(h => ({
      ...h, service_account_json: h.service_account_json ? '***' : null
    }));
    res.json({ success: true, data: veri });
  } catch (err) { next(err); }
};

// Drive hesabı ekle
const driveEkle = async (req, res, next) => {
  try {
    const { ad, aciklama, service_account_json } = req.body;
    let jsonData;
    try { jsonData = typeof service_account_json === 'string' ? JSON.parse(service_account_json) : service_account_json; }
    catch { return res.status(400).json({ success: false, message: 'Geçersiz JSON formatı' }); }

    const ayarlar = await Ayarlar.findOne() || await Ayarlar.create(VARSAYILAN);
    ayarlar.drive_hesaplari.push({ ad, aciklama, service_account_json: jsonData, email: jsonData.client_email });
    await ayarlar.save();
    res.json({ success: true, message: 'Drive hesabı eklendi' });
  } catch (err) { next(err); }
};

// Drive bağlantı testi
const driveTesti = async (req, res, next) => {
  try {
    const ayarlar = await Ayarlar.findOne();
    const hesap = ayarlar?.drive_hesaplari?.id(req.params.id);
    if (!hesap) return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });

    const auth = new google.auth.GoogleAuth({
      credentials: hesap.service_account_json,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });
    const about = await drive.about.get({ fields: 'storageQuota,user' });
    const q = about.data.storageQuota;
    const kullanilan = q.usage ? Math.round(parseInt(q.usage) / 1024 / 1024) : 0;
    const toplam = q.limit ? Math.round(parseInt(q.limit) / 1024 / 1024 / 1024) : 15;

    res.json({ success: true, data: { kullanici: about.data.user?.displayName, kullanilan_mb: kullanilan, toplam_gb: toplam } });
  } catch (err) { res.status(400).json({ success: false, message: `Bağlantı hatası: ${err.message}` }); }
};

// Drive hesabı sil
const driveSil = async (req, res, next) => {
  try {
    const ayarlar = await Ayarlar.findOne();
    ayarlar.drive_hesaplari.id(req.params.id).deleteOne();
    await ayarlar.save();
    res.json({ success: true, message: 'Hesap silindi' });
  } catch (err) { next(err); }
};

// Genel güncelleme (kategoriler, renkler, tablolar vb.)
const guncelle = async (req, res, next) => {
  try {
    const izinliAlanlar = [
      'dosya_kategorileri', 'not_renkleri', 'toprak_siniflari',
      'yagis_kusaklari', 'yararlanilabilir_yesil_ot',
      'uretilen_yesil_ot', 'uretilen_kuru_ot'
    ];
    const ayarlar = await Ayarlar.findOne() || await Ayarlar.create(VARSAYILAN);
    izinliAlanlar.forEach(alan => {
      if (req.body[alan] !== undefined) ayarlar[alan] = req.body[alan];
    });
    await ayarlar.save();
    res.json({ success: true, message: 'Ayarlar güncellendi' });
  } catch (err) { next(err); }
};

// Varsayılanlara sıfırla
const sifirla = async (req, res, next) => {
  try {
    await Ayarlar.deleteMany({});
    const yeni = await Ayarlar.create(VARSAYILAN);
    res.json({ success: true, message: 'Varsayılanlara sıfırlandı', data: yeni });
  } catch (err) { next(err); }
};

// İdari bölünme API
const Idari = require('../idari/idari.model');

const getIller = async (req, res, next) => {
  try {
    const iller = await Idari.find({ tip: 'il' }).sort({ ad: 1 }).select('xml_id ad');
    res.json({ success: true, data: iller });
  } catch (err) { next(err); }
};

const getIlceler = async (req, res, next) => {
  try {
    const ilceler = await Idari.find({ tip: 'ilce', il_id: req.params.il_id }).sort({ ad: 1 }).select('xml_id ilce_id ad');
    res.json({ success: true, data: ilceler });
  } catch (err) { next(err); }
};

const getMahalleler = async (req, res, next) => {
  try {
    const mahalleler = await Idari.find({ tip: 'mahalle', ilce_id: req.params.ilce_id }).sort({ ad: 1 }).select('xml_id ad');
    res.json({ success: true, data: mahalleler });
  } catch (err) { next(err); }
};

module.exports = { getAyarlar, driveEkle, driveTesti, driveSil, guncelle, sifirla, getIller, getIlceler, getMahalleler };
