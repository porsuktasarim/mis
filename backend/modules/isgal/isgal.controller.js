const Isgal = require('./isgal.model');
const Mera = require('../mera/mera.model');
const Ayarlar = require('../ayarlar/ayarlar.model');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Drive yardımcı ────────────────────────────────────────
const getDriveClient = async () => {
  const ayarlar = await Ayarlar.findOne();
  const hesap = ayarlar?.drive_hesaplari?.find(h => h.aktif);
  if (!hesap) throw new Error('Aktif Drive hesabı bulunamadı.');
  if (hesap.tip === 'oauth2') {
    const { client_id, client_secret } = hesap.oauth_client_json.installed || hesap.oauth_client_json.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    oauth2.setCredentials(hesap.oauth_token);
    oauth2.on('tokens', async (tokens) => {
      const guncellenen = { ...hesap.oauth_token, ...tokens };
      await Ayarlar.updateOne({ 'drive_hesaplari._id': hesap._id }, { $set: { 'drive_hesaplari.$.oauth_token': guncellenen } });
    });
    return google.drive({ version: 'v3', auth: oauth2 });
  }
  const auth = new google.auth.GoogleAuth({ credentials: hesap.service_account_json, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
};

const getMisDriveFolder = async (drive, altKlasor) => {
  const misRes = await drive.files.list({ q: `name='MİS' and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
  if (!misRes.data.files.length) throw new Error("Drive'da 'MİS' klasörü bulunamadı.");
  let parentId = misRes.data.files[0].id;
  for (const klasor of altKlasor) {
    const res = await drive.files.list({ q: `name='${klasor}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`, fields: 'files(id)' });
    if (res.data.files.length) { parentId = res.data.files[0].id; }
    else {
      const yeni = await drive.files.create({ requestBody: { name: klasor, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' });
      parentId = yeni.data.id;
    }
  }
  return parentId;
};

const driveYukle = async (drive, folderId, dosyaAdi, mimeType, buffer) => {
  const { Readable } = require('stream');
  const stream = new Readable(); stream.push(buffer); stream.push(null);
  const res = await drive.files.create({
    requestBody: { name: dosyaAdi, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: 'id,webViewLink,webContentLink',
  });
  await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  return res.data;
};

// ── Otomatik isgal_no üret ────────────────────────────────
const isgalNoUret = async (mera_id) => {
  const meraIsgaller = await Isgal.countDocuments({ mera_id });
  return `ISG-${Date.now().toString(36).toUpperCase()}-${meraIsgaller + 1}`;
};

// ── CRUD ──────────────────────────────────────────────────
const listele = async (req, res, next) => {
  try {
    const { mera_id, durum, ara, sayfa = 1, limit = 20 } = req.query;
    const filtre = {};
    if (mera_id) filtre.mera_id = mera_id;
    if (durum) filtre.durum = durum;
    if (ara) filtre.$or = [
      { isgal_no: new RegExp(ara, 'i') },
      { isgalci_ad_soyad: new RegExp(ara, 'i') },
      { mera_parsel: new RegExp(ara, 'i') },
    ];

    const bugun = new Date();
    const toplam = await Isgal.countDocuments(filtre);
    const isgaller = await Isgal.find(filtre)
      .sort({ createdAt: -1 })
      .skip((sayfa - 1) * limit)
      .limit(parseInt(limit))
      .select('-adimlar.dosyalar -kml_katmanlar');

    // 15 gün uyarısı için 3091 adımlarını kontrol et
    const uyarilar = [];
    const aktifIsgaller = await Isgal.find({ durum: 'aktif' }).select('isgal_no mera_parsel mera_ad adimlar');
    aktifIsgaller.forEach(isgal => {
      isgal.adimlar.forEach(adim => {
        if (adim.tip === 'ucuncu_yol_3091' && adim.sure_bitis) {
          const kalan = Math.ceil((new Date(adim.sure_bitis) - bugun) / 86400000);
          if (kalan <= 3 && kalan >= 0) {
            uyarilar.push({ isgal_id: isgal._id, isgal_no: isgal.isgal_no, kalan_gun: kalan, tip: '3091_sure' });
          }
        }
      });
    });

    res.json({ success: true, toplam, sayfa: parseInt(sayfa), data: isgaller, uyarilar });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    res.json({ success: true, data: isgal });
  } catch (err) { next(err); }
};

const olustur = async (req, res, next) => {
  try {
    const { mera_id, tespit_sekli, tespit_tarihi, tespit_eden, isgal_tarihi,
      isgal_turu, isgal_turu_aciklama, isgal_alani_m2,
      isgalci_ad_soyad, isgalci_tc, isgalci_adres, aciklama } = req.body;

    const mera = await Mera.findById(mera_id).select('il_ad ilce_ad mahalle_ad ada parsel nitelik');
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });

    const isgal_no = await isgalNoUret(mera_id);

    const isgal = await Isgal.create({
      mera_id, isgal_no,
      mera_il_ad: mera.il_ad, mera_ilce_ad: mera.ilce_ad,
      mera_mahalle_ad: mera.mahalle_ad, mera_ada: mera.ada, mera_parsel: mera.parsel,
      mera_nitelik: mera.nitelik,
      tespit_sekli, tespit_tarihi, tespit_eden, isgal_tarihi,
      isgal_turu, isgal_turu_aciklama, isgal_alani_m2,
      isgalci_ad_soyad, isgalci_tc, isgalci_adres, aciklama,
    });

    res.status(201).json({ success: true, data: isgal });
  } catch (err) { next(err); }
};

const guncelle = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    const alanlar = ['tespit_sekli','tespit_tarihi','tespit_eden','isgal_tarihi','isgal_turu',
      'isgal_turu_aciklama','isgal_alani_m2','isgalci_ad_soyad','isgalci_tc','isgalci_adres',
      'durum','komisyon_karar_tipi','aciklama'];
    alanlar.forEach(alan => { if (req.body[alan] !== undefined) isgal[alan] = req.body[alan]; });
    await isgal.save();
    res.json({ success: true, data: isgal });
  } catch (err) { next(err); }
};

const sil = async (req, res, next) => {
  try {
    await Isgal.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'İşgal silindi' });
  } catch (err) { next(err); }
};

// ── Adım ekle ─────────────────────────────────────────────
const adimEkle = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Belge yüklemek zorunludur' });

    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });

    const { tip, aciklama, sorumlu, sure_gun } = req.body;

    // Drive'a yükle
    const drive = await getDriveClient();
    const tarihStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const surum = Math.random().toString(36).slice(2,5).toUpperCase();
    const dosyaAdi = `${tarihStr}-${tip}-${surum}${path.extname(req.file.originalname)}`;
    const folderId = await getMisDriveFolder(drive, [
      isgal.mera_il_ad, isgal.mera_ilce_ad, isgal.mera_mahalle_ad,
      `${isgal.mera_ada||'0'}-${isgal.mera_parsel}`, 'İşgal', isgal.isgal_no
    ]);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, req.file.mimetype, req.file.buffer);

    const adim = {
      tip, aciklama, sorumlu,
      dosyalar: [{
        ad: dosyaAdi,
        drive_file_id: driveData.id,
        drive_web_link: driveData.webViewLink,
        drive_download_link: `https://drive.google.com/uc?export=download&id=${driveData.id}`,
        mime_type: req.file.mimetype,
        boyut: req.file.size,
      }],
    };

    // 3091 için 15 gün sayacı
    if (tip === 'ucuncu_yol_3091') {
      const sure = parseInt(sure_gun) || 15;
      const bitis = new Date();
      bitis.setDate(bitis.getDate() + sure);
      adim.sure_bitis = bitis;
    }

    isgal.adimlar.push(adim);

    // Durum güncelle
    if (tip === 'sonuc') isgal.durum = 'cozuldu';
    if (tip === 'dava_men_mudahale') isgal.durum = 'mahkemede';

    await isgal.save();
    res.json({ success: true, data: isgal.adimlar[isgal.adimlar.length - 1] });
  } catch (err) { next(err); }
};

// ── KML yükle ─────────────────────────────────────────────
const kmlYukle = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    if (!isgal) return res.status(404).json({ success: false, message: 'İşgal bulunamadı' });
    if (!req.file) return res.status(400).json({ success: false, message: 'KML dosyası seçin' });

    let buffer = req.file.buffer;
    if (req.file.originalname.toLowerCase().endsWith('.kmz')) {
      const JSZip = require('jszip');
      const zip = await JSZip.loadAsync(buffer);
      const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
      if (!kmlFile) return res.status(400).json({ success: false, message: 'KMZ içinde KML bulunamadı' });
      buffer = Buffer.from(await zip.files[kmlFile].async('arraybuffer'));
    }

    const { renk } = req.body;
    const drive = await getDriveClient();
    const tarihStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const surum = Math.random().toString(36).slice(2,5).toUpperCase();
    const dosyaAdi = `${isgal.mera_il_ad}-${isgal.mera_ilce_ad}-${isgal.mera_mahalle_ad}-${isgal.mera_ada||'0'}-${isgal.mera_parsel}-isgal-${tarihStr}-${surum}.kml`;
    const folderId = await getMisDriveFolder(drive, [
      isgal.mera_il_ad, isgal.mera_ilce_ad, isgal.mera_mahalle_ad,
      `${isgal.mera_ada||'0'}-${isgal.mera_parsel}`, 'İşgal', isgal.isgal_no, 'KML'
    ]);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, 'application/vnd.google-earth.kml+xml', buffer);

    isgal.kml_katmanlar.push({
      drive_file_id: driveData.id,
      drive_web_link: driveData.webViewLink,
      drive_download_link: `https://drive.google.com/uc?export=download&id=${driveData.id}`,
      dosya_adi: dosyaAdi,
      renk: renk || '#FF0000',
    });
    await isgal.save();
    res.json({ success: true, data: isgal.kml_katmanlar[isgal.kml_katmanlar.length - 1] });
  } catch (err) { next(err); }
};

// ── KML getir (backend proxy) ─────────────────────────────
const kmlGetir = async (req, res, next) => {
  try {
    const isgal = await Isgal.findById(req.params.id);
    const katman = isgal?.kml_katmanlar?.id(req.params.kmlId);
    if (!katman) return res.status(404).json({ success: false, message: 'KML bulunamadı' });
    const drive = await getDriveClient();
    const response = await drive.files.get({ fileId: katman.drive_file_id, alt: 'media' }, { responseType: 'arraybuffer' });
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', 'inline; filename="isgal.kml"');
    res.send(Buffer.from(response.data));
  } catch (err) { next(err); }
};

// ── İstatistik ────────────────────────────────────────────
const istatistik = async (req, res, next) => {
  try {
    const bugun = new Date();
    const [toplam, aktif, mahkemede, cozuldu] = await Promise.all([
      Isgal.countDocuments(),
      Isgal.countDocuments({ durum: 'aktif' }),
      Isgal.countDocuments({ durum: 'mahkemede' }),
      Isgal.countDocuments({ durum: 'cozuldu' }),
    ]);

    // 3091 süresi dolan/dolmak üzere olan işgaller
    const sure_uyarilari = [];
    const aktifIsgaller = await Isgal.find({ durum: 'aktif' })
      .select('isgal_no mera_parsel mera_il_ad mera_mahalle_ad adimlar');
    aktifIsgaller.forEach(isgal => {
      isgal.adimlar.forEach(adim => {
        if (adim.tip === 'ucuncu_yol_3091' && adim.sure_bitis) {
          const kalan = Math.ceil((new Date(adim.sure_bitis) - bugun) / 86400000);
          if (kalan <= 3) sure_uyarilari.push({
            isgal_id: isgal._id, isgal_no: isgal.isgal_no,
            mera: `${isgal.mera_il_ad} / ${isgal.mera_mahalle_ad} Parsel: ${isgal.mera_parsel}`,
            kalan_gun: kalan, sure_bitis: adim.sure_bitis,
          });
        }
      });
    });

    res.json({ success: true, data: { toplam, aktif, mahkemede, cozuldu, sure_uyarilari } });
  } catch (err) { next(err); }
};

module.exports = {
  listele, getById, olustur, guncelle, sil,
  adimEkle: [upload.single('belge'), adimEkle],
  kmlYukle: [upload.single('kml'), kmlYukle],
  kmlGetir,
  istatistik,
};
