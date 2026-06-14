const Mevzuat = require('./mevzuat.model');
const Ayarlar = require('../ayarlar/ayarlar.model');
const { google } = require('googleapis');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ── Drive ─────────────────────────────────────────────────
const getDriveClient = async () => {
  const ayarlar = await Ayarlar.findOne();
  const hesap = ayarlar?.drive_hesaplari?.find(h => h.aktif);
  if (!hesap) throw new Error('Aktif Drive hesabı bulunamadı.');
  if (hesap.tip === 'oauth2') {
    const { client_id, client_secret } = hesap.oauth_client_json.installed || hesap.oauth_client_json.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    oauth2.setCredentials(hesap.oauth_token);
    oauth2.on('tokens', async (tokens) => {
      await Ayarlar.updateOne({ 'drive_hesaplari._id': hesap._id }, { $set: { 'drive_hesaplari.$.oauth_token': { ...hesap.oauth_token, ...tokens } } });
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
    if (res.data.files.length) parentId = res.data.files[0].id;
    else { const y = await drive.files.create({ requestBody: { name: klasor, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }, fields: 'id' }); parentId = y.data.id; }
  }
  return parentId;
};

const driveYukle = async (drive, folderId, dosyaAdi, mimeType, buffer) => {
  const { Readable } = require('stream');
  const s = new Readable(); s.push(buffer); s.push(null);
  const res = await drive.files.create({ requestBody: { name: dosyaAdi, parents: [folderId] }, media: { mimeType, body: s }, fields: 'id,webViewLink,webContentLink' });
  await drive.permissions.create({ fileId: res.data.id, requestBody: { role: 'reader', type: 'anyone' } });
  return res.data;
};

// ── mevzuat.gov.tr çekme (bedesten.adalet.gov.tr API) ────
const mevzuatGovCek = async (url) => {
  const axios = require('axios');

  const urlObj = new URL(url);
  const mevzuatNo = urlObj.searchParams.get('MevzuatNo');
  const mevzuatTur = urlObj.searchParams.get('MevzuatTur');

  if (!mevzuatNo) throw new Error('Geçersiz URL. MevzuatNo parametresi gerekli.');

  // MevzuatTur → bedesten tur kodu
  const TUR_MAP = { '1':'KANUN','2':'KHK','3':'TUZUK','4':'YONETMELIK','7':'TEBLIGLER','8':'CB_KARARNAME','9':'CB_KARAR','10':'CB_YONETMELIK','11':'CB_GENELGE' };
  const bedestenTur = mevzuatTur ? TUR_MAP[mevzuatTur] : null;

  const BEDESTEN_BASE = 'https://bedesten.adalet.gov.tr/mevzuat';
  const HEADERS = {
    'Content-Type': 'application/json; charset=utf-8',
    'AdaletApplicationName': 'UyapMevzuat',
    'Origin': 'https://mevzuat.adalet.gov.tr',
    'Referer': 'https://mevzuat.adalet.gov.tr/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  const wrap = (data) => ({ data, applicationName: 'UyapMevzuat' });
  const wrapPaging = (data) => ({ data, applicationName: 'UyapMevzuat', paging: true });

  let mevzuatId = null, ad = '', resmGazTarih = null, resmGazSayi = '';

  // 1. Adım: mevzuat no ile arama yap → ID bul
  console.log(`[Mevzuat] Aranıyor: No=${mevzuatNo}, Tür=${bedestenTur||'?'}`);
  try {
    const searchBody = { mevzuatNo, pageSize: 5, pageNumber: 1, sortFields: ['RESMI_GAZETE_TARIHI'], sortDirection: 'desc' };
    if (bedestenTur) searchBody.mevzuatTurList = [bedestenTur];
    const searchRes = await axios.post(`${BEDESTEN_BASE}/searchDocuments`, wrapPaging(searchBody), { headers: HEADERS, timeout: 20000 });
    const searchData = searchRes.data?.data;
    const docs = searchData?.mevzuatList || [];
    console.log(`[Mevzuat] Arama sonucu: ${docs.length} kayıt`);

    if (docs.length > 0) {
      const doc = docs[0];
      mevzuatId = doc.id || doc.mevzuatId;
      ad = doc.mevzuatAdi || doc.ad || '';
      resmGazSayi = doc.resmiGazeteSayisi || '';
      if (doc.resmiGazeteTarihi) resmGazTarih = new Date(doc.resmiGazeteTarihi);
      console.log(`[Mevzuat] Bulundu: ${ad}, ID: ${mevzuatId}`);
    }
  } catch (e) {
    console.error(`[Mevzuat] Arama hatası: ${e.message}`);
    throw new Error(`mevzuat.gov.tr araması başarısız: ${e.message}`);
  }

  if (!mevzuatId) throw new Error(`${mevzuatNo} numaralı mevzuat bulunamadı.`);

  // 2. Adım: içeriği çek (base64 HTML)
  let htmlIcerik = '', metinIcerik = '';
  try {
    console.log(`[Mevzuat] İçerik çekiliyor: ID=${mevzuatId}`);
    const contentRes = await axios.post(`${BEDESTEN_BASE}/getDocumentContent`,
      wrap({ documentType: 'MEVZUAT', id: mevzuatId }),
      { headers: HEADERS, timeout: 30000 }
    );
    const contentData = contentRes.data?.data;
    if (contentData?.content) {
      htmlIcerik = Buffer.from(contentData.content, 'base64').toString('utf-8');
      console.log(`[Mevzuat] İçerik çekildi: ${htmlIcerik.length} karakter`);
      // HTML'den metin çıkar
      metinIcerik = htmlIcerik
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100000);
    }
  } catch (e) {
    console.error(`[Mevzuat] İçerik hatası: ${e.message}`);
    // İçerik çekilemese de devam et - en azından ad ve ID var
  }

  const hash = crypto.createHash('md5').update(metinIcerik || mevzuatId).digest('hex');
  console.log(`[Mevzuat] Tamamlandı: "${ad}", metin: ${metinIcerik.length} kar, hash: ${hash}`);

  return { ad, htmlIcerik: htmlIcerik.slice(0, 500000), metinIcerik, hash, resmGazTarih, resmGazSayi, mevzuatNo, mevzuatId };
};

// ── CRUD ──────────────────────────────────────────────────
const listele = async (req, res, next) => {
  try {
    const { tur, ara, aktif = 'true' } = req.query;
    const filtre = {};
    if (aktif !== 'all') filtre.aktif = aktif === 'true';
    if (tur) filtre.tur = tur;
    if (ara) filtre.$or = [
      { ad: new RegExp(ara, 'i') },
      { mevzuat_no: new RegExp(ara, 'i') },
      { konu: new RegExp(ara, 'i') },
      { etiketler: new RegExp(ara, 'i') },
    ];
    const mevzuatlar = await Mevzuat.find(filtre)
      .sort({ tur: 1, ad: 1 })
      .select('-icerik -html_icerik -surumler');
    res.json({ success: true, data: mevzuatlar });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const mevzuat = await Mevzuat.findById(req.params.id);
    if (!mevzuat) return res.status(404).json({ success: false, message: 'Mevzuat bulunamadı' });
    res.json({ success: true, data: mevzuat });
  } catch (err) { next(err); }
};

// PDF içeriğini backend'den serve et
const pdfGetir = async (req, res, next) => {
  try {
    const mevzuat = await Mevzuat.findById(req.params.id).select('drive_file_id ad');
    if (!mevzuat?.drive_file_id) return res.status(404).json({ success: false, message: 'PDF bulunamadı' });
    const drive = await getDriveClient();
    const response = await drive.files.get({ fileId: mevzuat.drive_file_id, alt: 'media' }, { responseType: 'arraybuffer' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${mevzuat.ad}.pdf"`);
    res.send(Buffer.from(response.data));
  } catch (err) { next(err); }
};

const olustur = async (req, res, next) => {
  try {
    const { ad, tur, resmi_gazete_tarihi, resmi_gazete_sayisi, mevzuat_no,
      konu, etiketler, icerik_tipi, icerik, harici_link, mevzuat_gov_url } = req.body;

    let dosyaData = {};
    let htmlIcerik = '';
    let metinIcerik = icerik || '';
    let hash = '';
    let fetchedAd = ad;
    let fetchedNo = mevzuat_no;
    let fetchedRGTarih = resmi_gazete_tarihi;
    let fetchedRGSayi = resmi_gazete_sayisi;

    if (icerik_tipi === 'pdf' && req.file) {
      const drive = await getDriveClient();
      const tarih = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const dosyaAdi = `${tarih}-${ad.replace(/\s/g,'-').slice(0,40)}.pdf`;
      const folderId = await getMisDriveFolder(drive, ['Mevzuat', tur || 'Diger']);
      const driveData = await driveYukle(drive, folderId, dosyaAdi, 'application/pdf', req.file.buffer);
      dosyaData = {
        drive_file_id: driveData.id,
        drive_web_link: driveData.webViewLink,
        drive_download_link: `https://drive.google.com/uc?export=download&id=${driveData.id}`,
      };
    }

    if (icerik_tipi === 'mevzuat_gov' && mevzuat_gov_url) {
      const cekilen = await mevzuatGovCek(mevzuat_gov_url);
      if (!fetchedAd && cekilen.ad) fetchedAd = cekilen.ad;
      htmlIcerik = cekilen.htmlIcerik;
      metinIcerik = cekilen.metinIcerik;
      hash = cekilen.hash;
      if (!fetchedNo) fetchedNo = cekilen.mevzuatNo;
      if (!fetchedRGTarih && cekilen.resmGazTarih) fetchedRGTarih = cekilen.resmGazTarih;
      if (!fetchedRGSayi && cekilen.resmGazSayi) fetchedRGSayi = cekilen.resmGazSayi;
    }

    if (metinIcerik && !hash) {
      hash = crypto.createHash('md5').update(metinIcerik).digest('hex');
    }

    const mevzuat = await Mevzuat.create({
      ad: fetchedAd, tur, konu, etiketler: etiketler ? JSON.parse(etiketler) : [],
      mevzuat_no: fetchedNo,
      resmi_gazete_tarihi: fetchedRGTarih,
      resmi_gazete_sayisi: fetchedRGSayi,
      icerik_tipi, icerik: metinIcerik, html_icerik: htmlIcerik,
      harici_link, mevzuat_gov_url,
      kaynak_hash: hash,
      son_kontrol: new Date(),
      ...dosyaData,
    });

    res.status(201).json({ success: true, data: mevzuat });
  } catch (err) { next(err); }
};

const guncelle = async (req, res, next) => {
  try {
    const mevzuat = await Mevzuat.findById(req.params.id);
    if (!mevzuat) return res.status(404).json({ success: false, message: 'Mevzuat bulunamadı' });
    const alanlar = ['ad','tur','resmi_gazete_tarihi','resmi_gazete_sayisi','mevzuat_no','konu','etiketler','aktif','guncelleme_bekleniyor'];
    alanlar.forEach(alan => { if (req.body[alan] !== undefined) mevzuat[alan] = req.body[alan]; });
    await mevzuat.save();
    res.json({ success: true, data: mevzuat });
  } catch (err) { next(err); }
};

const sil = async (req, res, next) => {
  try {
    await Mevzuat.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Güncelleme onayla ─────────────────────────────────────
const guncellemeyiOnayla = async (req, res, next) => {
  try {
    const mevzuat = await Mevzuat.findById(req.params.id);
    if (!mevzuat) return res.status(404).json({ success: false, message: 'Mevzuat bulunamadı' });
    mevzuat.guncelleme_bekleniyor = false;
    mevzuat.guncelleme_tarihi = new Date();
    await mevzuat.save();
    res.json({ success: true });
  } catch (err) { next(err); }
};

// ── Günlük kontrol (cron tarafından çağrılır) ─────────────
const gunlukKontrol = async () => {
  console.log('[Mevzuat] Günlük kontrol başladı:', new Date().toLocaleString('tr-TR'));
  const mevzuatlar = await Mevzuat.find({ icerik_tipi: 'mevzuat_gov', aktif: true, mevzuat_gov_url: { $exists: true, $ne: '' } });

  for (const mv of mevzuatlar) {
    try {
      const cekilen = await mevzuatGovCek(mv.mevzuat_gov_url);
      const yeniHash = cekilen.hash;

      if (yeniHash && yeniHash !== mv.kaynak_hash) {
        // Değişiklik var — eski sürümü arşivle
        mv.surumler.push({
          icerik: mv.icerik,
          html_icerik: mv.html_icerik,
          degisiklik_notu: `Otomatik güncelleme — önceki hash: ${mv.kaynak_hash}`,
          kontrol_tarihi: new Date(),
          kaynak_hash: mv.kaynak_hash,
        });
        mv.icerik = cekilen.metinIcerik;
        mv.html_icerik = cekilen.htmlIcerik;
        mv.kaynak_hash = yeniHash;
        mv.guncelleme_bekleniyor = true;
        mv.guncelleme_tarihi = new Date();
        await mv.save();
        console.log(`[Mevzuat] Değişiklik tespit edildi: ${mv.ad}`);
      } else {
        mv.son_kontrol = new Date();
        await mv.save();
      }
    } catch (e) {
      console.error(`[Mevzuat] Kontrol hatası (${mv.ad}):`, e.message);
    }
  }
  console.log('[Mevzuat] Günlük kontrol tamamlandı.');
};

// ── Manuel yenile ─────────────────────────────────────────
const manuelYenile = async (req, res, next) => {
  try {
    const mevzuat = await Mevzuat.findById(req.params.id);
    if (!mevzuat) return res.status(404).json({ success: false, message: 'Mevzuat bulunamadı' });
    if (mevzuat.icerik_tipi !== 'mevzuat_gov') return res.status(400).json({ success: false, message: 'Yalnızca mevzuat.gov.tr kaynakları yenilenebilir' });

    const cekilen = await mevzuatGovCek(mevzuat.mevzuat_gov_url);
    if (cekilen.hash !== mevzuat.kaynak_hash) {
      mevzuat.surumler.push({
        icerik: mevzuat.icerik, html_icerik: mevzuat.html_icerik,
        degisiklik_notu: 'Manuel yenileme',
        kontrol_tarihi: new Date(), kaynak_hash: mevzuat.kaynak_hash,
      });
      mevzuat.icerik = cekilen.metinIcerik;
      mevzuat.html_icerik = cekilen.htmlIcerik;
      mevzuat.kaynak_hash = cekilen.hash;
      mevzuat.guncelleme_bekleniyor = true;
    }
    mevzuat.son_kontrol = new Date();
    await mevzuat.save();
    res.json({ success: true, degisiklik: cekilen.hash !== mevzuat.kaynak_hash });
  } catch (err) { next(err); }
};

// ── İstatistik (ana sayfa için) ───────────────────────────
const istatistik = async (req, res, next) => {
  try {
    const [toplam, bekleyen] = await Promise.all([
      Mevzuat.countDocuments({ aktif: true }),
      Mevzuat.countDocuments({ aktif: true, guncelleme_bekleniyor: true }),
    ]);
    const guncellemeler = await Mevzuat.find({ aktif: true, guncelleme_bekleniyor: true })
      .select('ad tur guncelleme_tarihi').limit(10);
    res.json({ success: true, data: { toplam, bekleyen, guncellemeler } });
  } catch (err) { next(err); }
};

module.exports = {
  listele, getById, pdfGetir, olustur: [upload.single('pdf'), olustur],
  guncelle, sil, guncellemeyiOnayla, manuelYenile, istatistik, gunlukKontrol,
};
