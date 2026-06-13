const Ayarlar = require('./ayarlar.model');
const VARSAYILAN = require('./ayarlar.varsayilan');
const { google } = require('googleapis');

// Drive client oluştur (servis hesabı veya OAuth2)
const getDriveClientForHesap = async (hesap) => {
  if (hesap.tip === 'oauth2') {
    if (!hesap.oauth_client_json) throw new Error('OAuth client JSON eksik');
    if (!hesap.oauth_token) throw new Error('Henüz yetkilendirilmemiş. Ayarlar sayfasından yetkilendirin.');
    const { client_id, client_secret } = hesap.oauth_client_json.installed || hesap.oauth_client_json.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    oauth2.setCredentials(hesap.oauth_token);
    // Token yenile
    oauth2.on('tokens', async (tokens) => {
      if (tokens.refresh_token) hesap.oauth_token = { ...hesap.oauth_token, ...tokens };
      else hesap.oauth_token = { ...hesap.oauth_token, access_token: tokens.access_token };
      await Ayarlar.updateOne({ 'drive_hesaplari._id': hesap._id }, { $set: { 'drive_hesaplari.$.oauth_token': hesap.oauth_token } });
    });
    return google.drive({ version: 'v3', auth: oauth2 });
  }
  // Servis hesabı
  const auth = new google.auth.GoogleAuth({
    credentials: hesap.service_account_json,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
};

// Ayarları getir
const getAyarlar = async (req, res, next) => {
  try {
    let ayarlar = await Ayarlar.findOne();
    if (!ayarlar) ayarlar = await Ayarlar.create(VARSAYILAN);
    const veri = ayarlar.toObject();
    veri.drive_hesaplari = veri.drive_hesaplari.map(h => ({
      ...h,
      service_account_json: h.service_account_json ? '***' : null,
      oauth_client_json: h.oauth_client_json ? { client_id: (h.oauth_client_json.installed || h.oauth_client_json.web)?.client_id } : null,
      oauth_token: h.oauth_token ? '***' : null,
      yetkili: !!h.oauth_token || !!h.service_account_json,
    }));
    res.json({ success: true, data: veri });
  } catch (err) { next(err); }
};

// Drive hesabı ekle (servis hesabı veya OAuth2 client JSON)
const driveEkle = async (req, res, next) => {
  try {
    const { ad, aciklama, service_account_json, oauth_client_json } = req.body;
    const ayarlar = await Ayarlar.findOne() || await Ayarlar.create(VARSAYILAN);

    if (oauth_client_json) {
      let jsonData;
      try { jsonData = typeof oauth_client_json === 'string' ? JSON.parse(oauth_client_json) : oauth_client_json; }
      catch { return res.status(400).json({ success: false, message: 'Geçersiz JSON' }); }
      const credInfo = jsonData.installed || jsonData.web;
      if (!credInfo) return res.status(400).json({ success: false, message: 'Geçersiz OAuth client JSON' });
      ayarlar.drive_hesaplari.push({ ad, aciklama, tip: 'oauth2', oauth_client_json: jsonData, email: credInfo.client_id });
      await ayarlar.save();
      const hesap = ayarlar.drive_hesaplari[ayarlar.drive_hesaplari.length - 1];
      return res.json({ success: true, message: 'OAuth hesabı eklendi', hesap_id: hesap._id, tip: 'oauth2' });
    }

    if (service_account_json) {
      let jsonData;
      try { jsonData = typeof service_account_json === 'string' ? JSON.parse(service_account_json) : service_account_json; }
      catch { return res.status(400).json({ success: false, message: 'Geçersiz JSON' }); }
      ayarlar.drive_hesaplari.push({ ad, aciklama, tip: 'service_account', service_account_json: jsonData, email: jsonData.client_email });
      await ayarlar.save();
      return res.json({ success: true, message: 'Servis hesabı eklendi' });
    }

    return res.status(400).json({ success: false, message: 'JSON gerekli' });
  } catch (err) { next(err); }
};

// OAuth2 yetkilendirme URL'i üret
const driveOAuthUrl = async (req, res, next) => {
  try {
    const ayarlar = await Ayarlar.findOne();
    const hesap = ayarlar?.drive_hesaplari?.id(req.params.id);
    if (!hesap || hesap.tip !== 'oauth2') return res.status(404).json({ success: false, message: 'OAuth hesabı bulunamadı' });
    const { client_id, client_secret } = hesap.oauth_client_json.installed || hesap.oauth_client_json.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    const url = oauth2.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive'],
      prompt: 'consent',
    });
    res.json({ success: true, url });
  } catch (err) { next(err); }
};

// OAuth2 kod ile token al
const driveOAuthToken = async (req, res, next) => {
  try {
    const { kod } = req.body;
    const ayarlar = await Ayarlar.findOne();
    const hesap = ayarlar?.drive_hesaplari?.id(req.params.id);
    if (!hesap || hesap.tip !== 'oauth2') return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
    const { client_id, client_secret } = hesap.oauth_client_json.installed || hesap.oauth_client_json.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    const { tokens } = await oauth2.getToken(kod);
    hesap.oauth_token = tokens;
    // Email al
    oauth2.setCredentials(tokens);
    const gmail = google.oauth2({ version: 'v2', auth: oauth2 });
    try { const me = await gmail.userinfo.get(); hesap.email = me.data.email; } catch {}
    await ayarlar.save();
    res.json({ success: true, message: 'Yetkilendirme başarılı', email: hesap.email });
  } catch (err) { res.status(400).json({ success: false, message: `Token hatası: ${err.message}` }); }
};

// Drive bağlantı testi
const driveTesti = async (req, res, next) => {
  try {
    const ayarlar = await Ayarlar.findOne();
    const hesap = ayarlar?.drive_hesaplari?.id(req.params.id);
    if (!hesap) return res.status(404).json({ success: false, message: 'Hesap bulunamadı' });
    const drive = await getDriveClientForHesap(hesap);
    const about = await drive.about.get({ fields: 'storageQuota,user' });
    const q = about.data.storageQuota;
    const kullanilan = q.usage ? Math.round(parseInt(q.usage) / 1024 / 1024) : 0;
    const toplam = q.limit ? Math.round(parseInt(q.limit) / 1024 / 1024 / 1024) : 15;
    res.json({ success: true, data: { kullanici: about.data.user?.displayName || hesap.email, kullanilan_mb: kullanilan, toplam_gb: toplam } });
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
    // Plaka sırasına göre (xml_id sayısal)
    const iller = await Idari.find({ tip: 'il' }).select('xml_id ad');
    iller.sort((a, b) => parseInt(a.xml_id) - parseInt(b.xml_id));
    res.json({ success: true, data: iller });
  } catch (err) { next(err); }
};

const getIlceler = async (req, res, next) => {
  try {
    const ilceler = await Idari.find({ tip: 'ilce', il_id: req.params.il_id })
      .collation({ locale: 'tr', strength: 1 })
      .sort({ ad: 1 }).select('xml_id ilce_id ad');
    res.json({ success: true, data: ilceler });
  } catch (err) { next(err); }
};

const getMahalleler = async (req, res, next) => {
  try {
    const mahalleler = await Idari.find({ tip: 'mahalle', ilce_id: req.params.ilce_id })
      .collation({ locale: 'tr', strength: 1 })
      .sort({ ad: 1 }).select('xml_id ad');
    res.json({ success: true, data: mahalleler });
  } catch (err) { next(err); }
};

// İdari kayıt ekle
const idariEkle = async (req, res, next) => {
  try {
    const { tip, ad, il_id, il_ad, ilce_id, ilce_ad } = req.body;
    const yeni = await Idari.create({ tip, ad, il_id, il_ad, ilce_id, ilce_ad, xml_id: Date.now().toString() });
    res.json({ success: true, data: yeni });
  } catch (err) { next(err); }
};

// İdari kayıt güncelle (isim düzeltme)
const idariGuncelle = async (req, res, next) => {
  try {
    const kayit = await Idari.findByIdAndUpdate(req.params.id, { ad: req.body.ad }, { new: true });
    if (!kayit) return res.status(404).json({ success: false, message: 'Kayıt bulunamadı' });
    res.json({ success: true, data: kayit });
  } catch (err) { next(err); }
};

// İdari kayıt sil
const idariSil = async (req, res, next) => {
  try {
    await Idari.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Silindi' });
  } catch (err) { next(err); }
};

// İl öncelikleri kaydet
const idariOncelikKaydet = async (req, res, next) => {
  try {
    const ayarlar = await Ayarlar.findOne() || await Ayarlar.create(VARSAYILAN);
    ayarlar.idari_oncelikler = req.body.oncelikler || [];
    await ayarlar.save();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// İl mahallelerini ara
const idariAra = async (req, res, next) => {
  try {
    const { tip, il_id, ilce_id, ara } = req.query;
    const filtre = { tip };
    if (il_id) filtre.il_id = il_id;
    if (ilce_id) filtre.ilce_id = ilce_id;
    if (ara) filtre.ad = new RegExp(ara, 'i');
    const kayitlar = await Idari.find(filtre)
      .collation({ locale: 'tr', strength: 1 })
      .sort({ ad: 1 }).limit(100).select('xml_id ad il_id il_ad ilce_id ilce_ad');
    res.json({ success: true, data: kayitlar });
  } catch (err) { next(err); }
};

// Şifre doğrula
const sifreDogrula = (req, res) => {
  const { sifre } = req.body;
  const dogruSifre = process.env.AYARLAR_SIFRE || '123456';
  if (sifre === dogruSifre) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Şifre yanlış' });
  }
};

// Şifre değiştir
const sifreDegistir = (req, res) => {
  const { eskiSifre, yeniSifre } = req.body;
  const dogruSifre = process.env.AYARLAR_SIFRE || '123456';
  if (eskiSifre !== dogruSifre) {
    return res.status(401).json({ success: false, message: 'Mevcut şifre yanlış' });
  }
  if (!yeniSifre || yeniSifre.length < 4) {
    return res.status(400).json({ success: false, message: 'Yeni şifre en az 4 karakter olmalı' });
  }
  // .env dosyasını güncelle
  const fs = require('fs');
  const path = require('path');
  const envPath = path.join(__dirname, '../../.env');
  try {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (envContent.includes('AYARLAR_SIFRE=')) {
      envContent = envContent.replace(/AYARLAR_SIFRE=.*/,  `AYARLAR_SIFRE=${yeniSifre}`);
    } else {
      envContent += `\nAYARLAR_SIFRE=${yeniSifre}`;
    }
    fs.writeFileSync(envPath, envContent);
    process.env.AYARLAR_SIFRE = yeniSifre;
    res.json({ success: true, message: 'Şifre değiştirildi' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Şifre kaydedilemedi: ' + e.message });
  }
};

module.exports = { getAyarlar, driveEkle, driveTesti, driveSil, driveOAuthUrl, driveOAuthToken,
  guncelle, sifirla,
  getIller, getIlceler, getMahalleler, idariEkle, idariGuncelle, idariSil, idariOncelikKaydet, idariAra,
  sifreDogrula, sifreDegistir };
