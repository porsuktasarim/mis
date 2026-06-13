const Mera = require('./mera.model');
const Ayarlar = require('../ayarlar/ayarlar.model');
const { google } = require('googleapis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Görsel ve PDF limitler
const GORSEL_MAX_W = 1920;
const GORSEL_MAX_H = 1920;
const GORSEL_KALITE = 85;
const PDF_MAX_MB = 20;

let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

// Görsel sıkıştır
const gorselSikistir = async (buffer, mimeType) => {
  if (!sharp) return buffer;
  const goruntuMime = ['image/jpeg','image/jpg','image/png','image/webp'];
  if (!goruntuMime.includes(mimeType)) return buffer;
  try {
    return await sharp(buffer)
      .resize(GORSEL_MAX_W, GORSEL_MAX_H, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: GORSEL_KALITE })
      .toBuffer();
  } catch { return buffer; }
};

// ── Drive yardımcı ────────────────────────────────────────
const getDriveClient = async () => {
  const ayarlar = await Ayarlar.findOne();
  const hesap = ayarlar?.drive_hesaplari?.find(h => h.aktif);
  if (!hesap) throw new Error('Aktif Drive hesabı bulunamadı. Ayarlar sayfasından ekleyin.');

  if (hesap.tip === 'oauth2') {
    if (!hesap.oauth_token) throw new Error('Drive hesabı yetkilendirilmemiş. Ayarlar > Google Drive > Yetkilendir.');
    const { client_id, client_secret } = hesap.oauth_client_json.installed || hesap.oauth_client_json.web;
    const oauth2 = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');
    oauth2.setCredentials(hesap.oauth_token);
    oauth2.on('tokens', async (tokens) => {
      const guncellenen = { ...hesap.oauth_token, ...tokens };
      await Ayarlar.updateOne({ 'drive_hesaplari._id': hesap._id }, { $set: { 'drive_hesaplari.$.oauth_token': guncellenen } });
    });
    return google.drive({ version: 'v3', auth: oauth2 });
  }

  const auth = new google.auth.GoogleAuth({
    credentials: hesap.service_account_json,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return google.drive({ version: 'v3', auth });
};

const getMisDriveFolder = async (drive, altKlasor) => {
  // MİS ana klasörünü bul
  const misRes = await drive.files.list({
    q: `name='MİS' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id,name)',
  });
  if (!misRes.data.files.length) throw new Error("Drive'da 'MİS' klasörü bulunamadı.");
  let parentId = misRes.data.files[0].id;

  // Alt klasörleri sırayla oluştur/bul
  for (const klasor of altKlasor) {
    const res = await drive.files.list({
      q: `name='${klasor}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
    });
    if (res.data.files.length) {
      parentId = res.data.files[0].id;
    } else {
      const yeni = await drive.files.create({
        requestBody: { name: klasor, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
        fields: 'id',
      });
      parentId = yeni.data.id;
    }
  }
  return parentId;
};

const driveYukle = async (drive, folderId, dosyaAdi, mimeType, buffer) => {
  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  const res = await drive.files.create({
    requestBody: { name: dosyaAdi, parents: [folderId] },
    media: { mimeType, body: stream },
    fields: 'id,webViewLink,webContentLink',
  });
  // Herkese açık yap
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  return res.data;
};

// ── Otlatma kapasitesi hesapla ────────────────────────────
const hesaplaOtlatma = async (il_id, vasif, alan_da) => {
  const ayarlar = await Ayarlar.findOne();
  if (!ayarlar) return null;
  const kusak = ayarlar.yagis_kusaklari?.find(y => y.il_id === String(il_id))?.kusak;
  if (!kusak || !vasif || !alan_da) return null;

  const vasifKey = { 'Çok İyi': 'cok_iyi', 'İyi': 'iyi', 'Orta': 'orta', 'Zayıf': 'zayif' }[vasif];
  const t1 = ayarlar.yararlanilabilir_yesil_ot?.find(r => r.kusak === kusak);
  const t2 = ayarlar.uretilen_yesil_ot?.find(r => r.kusak === kusak);
  const t3 = ayarlar.uretilen_kuru_ot?.find(r => r.kusak === kusak);
  if (!t1 || !t2 || !t3) return null;

  const yyo_kg = parseFloat((t1[vasifKey] * alan_da).toFixed(2));
  const uyo_kg = parseFloat((t2[vasifKey] * alan_da).toFixed(2));
  const uko_kg = parseFloat((t3[vasifKey] * alan_da).toFixed(2));
  const kapasite = parseFloat((yyo_kg / 50 / 180).toFixed(4));

  return {
    kusak, vasif, alan_da,
    yararlanilabilir_yesil_ot_kg: yyo_kg,
    yararlanilabilir_yesil_ot_ton: parseFloat((yyo_kg / 1000).toFixed(3)),
    uretilen_yesil_ot_kg: uyo_kg,
    uretilen_yesil_ot_ton: parseFloat((uyo_kg / 1000).toFixed(3)),
    uretilen_kuru_ot_kg: uko_kg,
    uretilen_kuru_ot_ton: parseFloat((uko_kg / 1000).toFixed(3)),
    otlatma_kapasitesi_bbhb: kapasite,
    hayvan_sayisi_180gun: Math.floor(kapasite),
    hesaplama_tarihi: new Date(),
  };
};

// ── CRUD ──────────────────────────────────────────────────
const listele = async (req, res, next) => {
  try {
    const { il_id, ilce_id, mahalle_id, durum, ara, sayfa = 1, limit = 20 } = req.query;
    const filtre = {};
    if (il_id) filtre.il_id = il_id;
    if (ilce_id) filtre.ilce_id = ilce_id;
    if (mahalle_id) filtre.mahalle_id = mahalle_id;
    if (durum) filtre.durum = durum;
    if (ara) filtre.$or = [
      { ada: new RegExp(ara, 'i') },
      { parsel: new RegExp(ara, 'i') },
      { mahalle_ad: new RegExp(ara, 'i') },
      { nitelik: new RegExp(ara, 'i') },
    ];
    const toplam = await Mera.countDocuments(filtre);
    const meralar = await Mera.find(filtre)
      .sort({ createdAt: -1 })
      .skip((sayfa - 1) * limit)
      .limit(parseInt(limit))
      .select('-notlar -dosyalar -kml_koordinatlar');
    res.json({ success: true, toplam, sayfa: parseInt(sayfa), limit: parseInt(limit), data: meralar });
  } catch (err) { next(err); }
};

const getById = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    res.json({ success: true, data: mera });
  } catch (err) { next(err); }
};

const olustur = async (req, res, next) => {
  try {
    const { il_id, il_ad, ilce_id, ilce_ad, mahalle_id, mahalle_ad, ada, parsel,
      tapu_alani_da, nitelik, vasif, toprak_sinifi, durum, aciklama } = req.body;

    const ayarlar = await Ayarlar.findOne();
    const toprakBilgi = ayarlar?.toprak_siniflari?.find(t => t.sinif === toprak_sinifi);

    const otlatma = vasif && tapu_alani_da && il_id
      ? await hesaplaOtlatma(il_id, vasif, parseFloat(tapu_alani_da))
      : null;

    const mera = await Mera.create({
      il_id, il_ad, ilce_id, ilce_ad, mahalle_id, mahalle_ad,
      ada, parsel, tapu_alani_da: parseFloat(tapu_alani_da) || 0,
      nitelik, vasif, toprak_sinifi,
      toprak_sinifi_tanim: toprakBilgi?.tanim || '',
      durum: durum || 'Aktif', aciklama, otlatma,
    });
    res.status(201).json({ success: true, data: mera });
  } catch (err) { next(err); }
};

const guncelle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    const guncellenecek = ['il_id','il_ad','ilce_id','ilce_ad','mahalle_id','mahalle_ad',
      'ada','parsel','tapu_alani_da','kadastral_alan_da','nitelik','vasif','toprak_sinifi','durum','aciklama'];
    guncellenecek.forEach(alan => { if (req.body[alan] !== undefined) mera[alan] = req.body[alan]; });
    if (req.body.mulkiyet !== undefined) mera.mulkiyet = { ...mera.mulkiyet?.toObject?.() || {}, ...req.body.mulkiyet };

    const ayarlar = await Ayarlar.findOne();
    if (req.body.toprak_sinifi) {
      const tb = ayarlar?.toprak_siniflari?.find(t => t.sinif === req.body.toprak_sinifi);
      mera.toprak_sinifi_tanim = tb?.tanim || '';
    }
    if (req.body.vasif || req.body.tapu_alani_da) {
      mera.otlatma = await hesaplaOtlatma(mera.il_id, mera.vasif, mera.tapu_alani_da) || mera.otlatma;
    }
    await mera.save();
    res.json({ success: true, data: mera });
  } catch (err) { next(err); }
};

const sil = async (req, res, next) => {
  try {
    await Mera.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Mera silindi' });
  } catch (err) { next(err); }
};

// ── KML Yükleme ───────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

const kmlYukle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya seçin' });

    let kmlBuffer = req.file.buffer;
    let mimeType = 'application/vnd.google-earth.kml+xml';

    if (req.file.originalname.toLowerCase().endsWith('.kmz')) {
      const JSZip = require('jszip');
      const zip = await JSZip.loadAsync(kmlBuffer);
      const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
      if (!kmlFile) return res.status(400).json({ success: false, message: 'KMZ içinde KML bulunamadı' });
      kmlBuffer = Buffer.from(await zip.files[kmlFile].async('arraybuffer'));
    }

    // Adlandırma: il-ilçe-mahalle-ada-parsel-YYYYMMDD-surum
    const tarihStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
    const surum = Math.random().toString(36).slice(2,6).toUpperCase();
    const temizle = (s) => (s||'').replace(/\s+/g,'-').replace(/[^a-zA-Z0-9\-_ğüşıöçĞÜŞİÖÇ]/g,'');
    const dosyaAdi = `${temizle(mera.il_ad)}-${temizle(mera.ilce_ad)}-${temizle(mera.mahalle_ad)}-${mera.ada||'0'}-${mera.parsel}-${tarihStr}-${surum}.kml`;

    const drive = await getDriveClient();
    const folderId = await getMisDriveFolder(drive, [mera.il_ad, mera.ilce_ad, mera.mahalle_ad, `${mera.ada||'0'}-${mera.parsel}`, 'KML']);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, mimeType, kmlBuffer);
    const downloadLink = `https://drive.google.com/uc?export=download&id=${driveData.id}`;

    // Eski KML'i geçmişe al
    if (mera.kml_drive_file_id) {
      mera.kml_gecmis.push({
        drive_file_id: mera.kml_drive_file_id,
        drive_web_link: mera.kml_drive_web_link,
        drive_download_link: mera.kml_drive_download_link,
        dosya_adi: mera.kml_gecmis.length > 0 ? `önceki-${mera.kml_gecmis.length}` : 'ilk',
        surum,
      });
    }

    // Aktif KML güncelle
    mera.kml_drive_file_id = driveData.id;
    mera.kml_drive_web_link = driveData.webViewLink;
    mera.kml_drive_download_link = downloadLink;

    // Dosyalar sekmesine de ekle
    mera.dosyalar.push({
      ad: dosyaAdi,
      kategori: 'KML Dosyası',
      kaynak: 'kml',
      drive_file_id: driveData.id,
      drive_web_link: driveData.webViewLink,
      drive_download_link: downloadLink,
      boyut: kmlBuffer.length,
      mime_type: mimeType,
    });

    await mera.save();
    res.json({ success: true, data: { file_id: driveData.id, web_link: driveData.webViewLink, download_link: downloadLink, dosya_adi: dosyaAdi } });
  } catch (err) { next(err); }
};

const kmlGetir = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id).select('kml_drive_file_id kml_drive_download_link');
    if (!mera?.kml_drive_file_id) return res.status(404).json({ success: false, message: 'KML bulunamadı' });
    const drive = await getDriveClient();
    const response = await drive.files.get({ fileId: mera.kml_drive_file_id, alt: 'media' }, { responseType: 'arraybuffer' });
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', 'inline; filename="parsel.kml"');
    res.send(Buffer.from(response.data));
  } catch (err) { next(err); }
};

// ── Not CRUD ──────────────────────────────────────────────
const notEkle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    const { icerik, renk, renk_adi, metin_rengi, dosya_id } = req.body;

    const notVerisi = {
      icerik,
      renk: renk || '#0d6efd',
      renk_adi: renk_adi || 'Bilgi',
      metin_rengi: metin_rengi || '#fff',
    };

    // Dosya yükleme varsa Drive'a at
    if (req.file) {
      const drive = await getDriveClient();
      const tarihStr = new Date().toISOString().slice(0,10).replace(/-/g,'');
      const surum = Math.random().toString(36).slice(2,6).toUpperCase();
      const dosyaAdi = `${tarihStr}-not-eki-${surum}${path.extname(req.file.originalname)}`;
      const folderId = await getMisDriveFolder(drive, [mera.il_ad, mera.ilce_ad, mera.mahalle_ad, `${mera.ada||'0'}-${mera.parsel}`, 'Notlar']);
      const driveData = await driveYukle(drive, folderId, dosyaAdi, req.file.mimetype, req.file.buffer);
      const downloadLink = `https://drive.google.com/uc?export=download&id=${driveData.id}`;

      // Dosyalar listesine ekle
      mera.dosyalar.push({
        ad: dosyaAdi,
        kategori: 'Not Eki',
        kaynak: 'dosyalar',
        drive_file_id: driveData.id,
        drive_web_link: driveData.webViewLink,
        drive_download_link: downloadLink,
        boyut: req.file.buffer.length,
        mime_type: req.file.mimetype,
        not_icerik: icerik,
      });
      notVerisi.dosya_id = mera.dosyalar[mera.dosyalar.length - 1]._id;
    } else if (dosya_id) {
      // Mevcut dosyadan seçim
      notVerisi.dosya_id = dosya_id;
    }

    mera.notlar.push(notVerisi);
    await mera.save();
    res.json({ success: true, data: mera.notlar[mera.notlar.length - 1] });
  } catch (err) { next(err); }
};

const notGuncelle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    const not = mera.notlar.id(req.params.notId);
    if (!not) return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    // Eski içeriği logla
    not.duzenlemeler.push({ eski_icerik: not.icerik });
    not.icerik = req.body.icerik || not.icerik;
    if (req.body.renk) { not.renk = req.body.renk; not.renk_adi = req.body.renk_adi; not.metin_rengi = req.body.metin_rengi; }
    await mera.save();
    res.json({ success: true, data: not });
  } catch (err) { next(err); }
};

const notSil = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    const not = mera.notlar.id(req.params.notId);
    if (!not) return res.status(404).json({ success: false, message: 'Not bulunamadı' });
    // Silmeyi logla
    not.duzenlemeler.push({ eski_icerik: not.icerik });
    not.icerik = '[SİLİNDİ]';
    await mera.save();
    res.json({ success: true, message: 'Not silindi (log tutuldu)' });
  } catch (err) { next(err); }
};

// ── Dosya Yükleme ─────────────────────────────────────────
const dosyaYukle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya seçin' });

    // PDF boyut kontrolü
    if (req.file.mimetype === 'application/pdf') {
      const mbCinsinden = req.file.size / 1024 / 1024;
      if (mbCinsinden > PDF_MAX_MB) {
        return res.status(400).json({ success: false, message: `PDF maksimum ${PDF_MAX_MB}MB olabilir (${mbCinsinden.toFixed(1)}MB)` });
      }
    }

    const { kategori, ad, not_icerik } = req.body;
    const tarih = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const surum = Math.random().toString(36).slice(2,6).toUpperCase();
    const dosyaAdi = `${tarih}-${(kategori || 'diger').replace(/\s/g,'-')}-${ad || surum}`;
    const ext = path.extname(req.file.originalname);
    const temizAd = dosyaAdi.endsWith(ext) ? dosyaAdi : dosyaAdi + ext;

    let buffer = req.file.buffer;
    let mimeType = req.file.mimetype;
    const goruntuMime = ['image/jpeg','image/jpg','image/png','image/webp'];
    if (goruntuMime.includes(mimeType)) {
      buffer = await gorselSikistir(buffer, mimeType);
      mimeType = 'image/jpeg';
    }

    const drive = await getDriveClient();
    const folderId = await getMisDriveFolder(drive, [
      mera.il_ad, mera.ilce_ad, mera.mahalle_ad,
      `${mera.ada || '0'}-${mera.parsel}`, kategori || 'Diger'
    ]);
    const driveData = await driveYukle(drive, folderId, temizAd, mimeType, buffer);
    const downloadLink = `https://drive.google.com/uc?export=download&id=${driveData.id}`;

    mera.dosyalar.push({
      ad: temizAd, kategori,
      kaynak: 'dosyalar',
      drive_file_id: driveData.id,
      drive_web_link: driveData.webViewLink,
      drive_download_link: downloadLink,
      boyut: buffer.length,
      mime_type: mimeType,
      not_icerik: not_icerik || '',
    });

    // Not ekleme
    if (not_icerik) {
      const { renk, renk_adi, metin_rengi } = req.body;
      mera.notlar.push({
        icerik: not_icerik,
        renk: renk || '#0d6efd',
        renk_adi: renk_adi || 'Bilgi',
        metin_rengi: metin_rengi || '#fff',
        dosya_id: mera.dosyalar[mera.dosyalar.length - 1]._id,
      });
    }

    await mera.save();
    res.json({ success: true, data: mera.dosyalar[mera.dosyalar.length - 1] });
  } catch (err) { next(err); }
};

const dosyaSil = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    const dosya = mera?.dosyalar?.id(req.params.dosyaId);
    if (!dosya) return res.status(404).json({ success: false, message: 'Dosya bulunamadı' });
    try {
      const drive = await getDriveClient();
      await drive.files.delete({ fileId: dosya.drive_file_id });
    } catch {}
    dosya.deleteOne();
    await mera.save();
    res.json({ success: true, message: 'Dosya silindi' });
  } catch (err) { next(err); }
};

// ── Rapor ─────────────────────────────────────────────────
const pdfRapor = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });

    const o = mera.otlatma;
    const m = mera.mulkiyet || {};
    const fmt = (n) => n != null ? Number(n).toLocaleString('tr-TR') : '-';

    const baslik = `${mera.il_ad} / ${mera.ilce_ad} / ${mera.mahalle_ad} — Ada: ${mera.ada||'-'} Parsel: ${mera.parsel}`;

    const sayfaBasligi = `
      <div class="sayfa-baslik">
        <strong>MERA PARSEL RAPORU</strong>
        <span class="kucuk">${baslik}</span>
      </div>`;

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>Mera Raporu - ${baslik}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Noto Sans',Arial,sans-serif;font-size:10pt;color:#222;padding:12mm 15mm;}
    .sayfa-baslik{border-bottom:2px solid #0F6E56;padding-bottom:3mm;margin-bottom:4mm;display:flex;justify-content:space-between;align-items:flex-end;}
    .sayfa-baslik strong{font-size:13pt;color:#0F6E56;}
    .sayfa-baslik .kucuk{font-size:9pt;color:#666;}
    h2{font-size:11pt;color:#0F6E56;margin:5mm 0 2mm;border-bottom:1px solid #9FE1CB;padding-bottom:1mm;}
    table{width:100%;border-collapse:collapse;margin-bottom:3mm;font-size:9.5pt;}
    th{background:#0F6E56;color:#fff;padding:3pt 7pt;text-align:left;font-size:9pt;}
    td{padding:3pt 7pt;border-bottom:1px solid #eee;vertical-align:top;}
    .label{color:#555;width:28%;font-size:9pt;}
    .val{font-weight:500;}
    .badge{display:inline-block;padding:1px 8px;border-radius:10px;font-size:8.5pt;}
    .footer{margin-top:6mm;font-size:8.5pt;color:#aaa;text-align:center;border-top:1px solid #ddd;padding-top:2mm;}
    .print-btn{text-align:center;margin-bottom:6mm;}
    @media print{
      .print-btn{display:none;}
      .sayfa-kirici{page-break-before:always;}
      .sayfa-baslik{display:flex!important;}
    }
  </style>
</head>
<body>
  <div class="print-btn">
    <button onclick="window.print()" style="background:#0F6E56;color:#fff;border:none;padding:7px 22px;border-radius:6px;font-size:11pt;cursor:pointer;">PDF Olarak Yazdır / Kaydet</button>
  </div>

  ${sayfaBasligi}

  <h2>Mera Bilgileri</h2>
  <table><tbody>
    <tr><td class="label">İl</td><td class="val">${mera.il_ad}</td><td class="label">İlçe</td><td class="val">${mera.ilce_ad}</td></tr>
    <tr><td class="label">Mahalle/Köy</td><td class="val">${mera.mahalle_ad}</td><td class="label">Ada / Parsel</td><td class="val">${mera.ada||'-'} / ${mera.parsel}</td></tr>
    <tr><td class="label">Tapu Alanı</td><td class="val">${fmt(mera.tapu_alani_da)} da</td><td class="label">Kadastral Alan</td><td class="val">${mera.kadastral_alan_da ? fmt(mera.kadastral_alan_da)+' da' : '-'}</td></tr>
    <tr><td class="label">Nitelik</td><td class="val">${mera.nitelik||'-'}</td><td class="label">Durum</td><td class="val">${mera.durum}</td></tr>
    <tr><td class="label">Vasıf</td><td class="val">${mera.vasif||'-'}${mera.vasif_bitis?` (${new Date(mera.vasif_bitis).toLocaleDateString('tr-TR')} bitiş)`:''}</td><td class="label">Toprak Sınıfı</td><td class="val">${mera.toprak_sinifi||'-'}</td></tr>
    <tr><td class="label">Tahsis Durumu</td><td class="val">${mera.tahsis_durumu||'-'}${mera.tahsis_durumu_bitis?` (${new Date(mera.tahsis_durumu_bitis).toLocaleDateString('tr-TR')} bitiş)`:''}</td><td class="label">KML Haritası</td><td class="val">${mera.kml_drive_file_id ? '✓ Yüklü' : '✗ Yüklenmemiş'}</td></tr>
  </tbody></table>

  ${(m.malik || m.cilt_no) ? `
  <h2>Mülkiyet Bilgileri (Tapu Kaydı)</h2>
  <table><tbody>
    <tr><td class="label">Cilt No</td><td class="val">${m.cilt_no||'-'}</td><td class="label">Sayfa No</td><td class="val">${m.sayfa_no||'-'}</td></tr>
    <tr><td class="label">Kayıt Durumu</td><td class="val">${m.kayit_durum||'-'}</td><td class="label">Pay / Payda</td><td class="val">${m.pay||'-'} / ${m.payda||'-'}</td></tr>
    <tr><td class="label">Malik</td><td class="val" colspan="3">${m.malik||'-'}</td></tr>
    ${m.serhler ? `<tr><td class="label">Şerhler</td><td class="val" colspan="3">${m.serhler}</td></tr>` : ''}
  </tbody></table>` : ''}

  ${o ? `
  <h2>Otlatma Kapasitesi</h2>
  <table><tbody>
    <tr><td class="label">Yağış Kuşağı</td><td class="val">${o.kusak} mm</td><td class="label">Vasıf</td><td class="val">${o.vasif}</td></tr>
    <tr><td class="label">Alan</td><td class="val">${fmt(o.alan_da)} da</td><td class="label">Otlatma Kap.</td><td class="val">${fmt(o.otlatma_kapasitesi_bbhb)} BBHB</td></tr>
    <tr><td class="label">180 Gün Hayvan</td><td class="val">${fmt(o.hayvan_sayisi_180gun)} baş</td><td class="label"></td><td></td></tr>
    <tr><td class="label">Yar. Yeşil Ot</td><td class="val">${fmt(o.yararlanilabilir_yesil_ot_ton)} ton (${fmt(o.yararlanilabilir_yesil_ot_kg)} kg)</td>
        <td class="label">Üretilen Yeşil Ot</td><td class="val">${fmt(o.uretilen_yesil_ot_ton)} ton</td></tr>
    <tr><td class="label">Üretilen Kuru Ot</td><td class="val">${fmt(o.uretilen_kuru_ot_ton)} ton (${fmt(o.uretilen_kuru_ot_kg)} kg)</td><td></td><td></td></tr>
  </tbody></table>` : ''}

  ${mera.notlar?.filter(n=>n.icerik!=='[SİLİNDİ]').length ? `
  <div class="sayfa-kirici"></div>
  ${sayfaBasligi}
  <h2>Notlar</h2>
  <table>
    <thead><tr><th style="width:25%">Tarih</th><th style="width:12%">Tür</th><th>İçerik</th></tr></thead>
    <tbody>
    ${mera.notlar.filter(n=>n.icerik!=='[SİLİNDİ]').map(n=>`
    <tr><td style="font-size:8.5pt;color:#666">${new Date(n.createdAt).toLocaleString('tr-TR')}</td>
    <td><span class="badge" style="background:${n.renk};color:${n.metin_rengi}">${n.renk_adi}</span></td>
    <td>${n.icerik}</td></tr>`).join('')}
    </tbody>
  </table>` : ''}

  ${mera.dosyalar?.length ? `
  <h2>Yüklü Dosyalar</h2>
  <table>
    <thead><tr><th>Dosya Adı</th><th style="width:20%">Kategori</th><th style="width:15%">Kaynak</th><th style="width:20%">Tarih</th></tr></thead>
    <tbody>
    ${mera.dosyalar.map(d=>{
      const kaynakMap = {kml:'KML',vasif:'Vasıf',tahsis:'Tahsis',dosyalar:'Genel'};
      return `<tr>
        <td style="font-size:8.5pt">${d.ad}</td>
        <td style="font-size:8.5pt">${d.kategori||'-'}</td>
        <td style="font-size:8.5pt">${kaynakMap[d.kaynak]||'-'}</td>
        <td style="font-size:8.5pt">${new Date(d.yukleme_tarihi||d.createdAt).toLocaleDateString('tr-TR')}</td>
      </tr>`;
    }).join('')}
    </tbody>
  </table>` : ''}

  <div class="footer">MİS - Mera İzleme Sistemi &nbsp;|&nbsp; Rapor Tarihi: ${new Date().toLocaleString('tr-TR')}</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) { next(err); }
};

// ── Vasıf Dosya Yükleme ───────────────────────────────────
const vasifDosyaYukle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya seçin' });
    const { vasif, tarih } = req.body;
    if (!tarih) return res.status(400).json({ success: false, message: 'Tarih zorunlu' });

    const tarihObj = new Date(tarih);
    const bitisTarihi = new Date(tarihObj);
    bitisTarihi.setFullYear(bitisTarihi.getFullYear() + 1);

    const drive = await getDriveClient();
    const tarihStr = tarihObj.toISOString().slice(0,10).replace(/-/g,'');
    const surum = Math.random().toString(36).slice(2,6).toUpperCase();
    const dosyaAdi = `${tarihStr}-teknik-personel-raporu-vasif-raporu-${surum}${path.extname(req.file.originalname)}`;
    const folderId = await getMisDriveFolder(drive, [mera.il_ad, mera.ilce_ad, mera.mahalle_ad, `${mera.ada||'0'}-${mera.parsel}`, 'Vasıf']);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, req.file.mimetype, req.file.buffer);
    const downloadLink = `https://drive.google.com/uc?export=download&id=${driveData.id}`;

    if (vasif) mera.vasif = vasif;
    mera.vasif_tarih = tarihObj;
    mera.vasif_bitis = bitisTarihi;
    mera.vasif_dosya_id = driveData.id;
    mera.vasif_dosya_link = driveData.webViewLink;

    // Dosyalar sekmesine ekle
    mera.dosyalar.push({
      ad: dosyaAdi,
      kategori: 'Teknik Personel Raporu',
      kaynak: 'vasif',
      drive_file_id: driveData.id,
      drive_web_link: driveData.webViewLink,
      drive_download_link: downloadLink,
      boyut: req.file.size,
      mime_type: req.file.mimetype,
    });

    await mera.save();
    res.json({ success: true, data: { vasif: mera.vasif, vasif_tarih: mera.vasif_tarih, vasif_bitis: mera.vasif_bitis, link: driveData.webViewLink } });
  } catch (err) { next(err); }
};

// ── Tahsis Durumu Dosya Yükleme ───────────────────────────
const tahsisDosyaYukle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    if (!req.file) return res.status(400).json({ success: false, message: 'Dosya seçin' });
    const { tahsis_durumu, tarih } = req.body;
    if (!tarih) return res.status(400).json({ success: false, message: 'Tarih zorunlu' });

    const tarihObj = new Date(tarih);
    const bitisTarihi = new Date(tarihObj);
    bitisTarihi.setFullYear(bitisTarihi.getFullYear() + 5);

    const drive = await getDriveClient();
    const tarihStr = tarihObj.toISOString().slice(0,10).replace(/-/g,'');
    const surum = Math.random().toString(36).slice(2,6).toUpperCase();
    const dosyaAdi = `${tarihStr}-tahsis-belgesi-${surum}${path.extname(req.file.originalname)}`;
    const folderId = await getMisDriveFolder(drive, [mera.il_ad, mera.ilce_ad, mera.mahalle_ad, `${mera.ada||'0'}-${mera.parsel}`, 'Tahsis']);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, req.file.mimetype, req.file.buffer);
    const downloadLink = `https://drive.google.com/uc?export=download&id=${driveData.id}`;

    if (tahsis_durumu) mera.tahsis_durumu = tahsis_durumu;
    mera.tahsis_durumu_tarih = tarihObj;
    mera.tahsis_durumu_bitis = bitisTarihi;
    mera.tahsis_durumu_dosya_id = driveData.id;
    mera.tahsis_durumu_dosya_link = driveData.webViewLink;

    // Dosyalar sekmesine ekle
    mera.dosyalar.push({
      ad: dosyaAdi,
      kategori: 'Tahsis Belgesi',
      kaynak: 'tahsis',
      drive_file_id: driveData.id,
      drive_web_link: driveData.webViewLink,
      drive_download_link: downloadLink,
      boyut: req.file.size,
      mime_type: req.file.mimetype,
    });

    await mera.save();
    res.json({ success: true, data: { tahsis_durumu: mera.tahsis_durumu, tarih: mera.tahsis_durumu_tarih, bitis: mera.tahsis_durumu_bitis, link: driveData.webViewLink } });
  } catch (err) { next(err); }
};

// ── İstatistik ────────────────────────────────────────────
const istatistik = async (req, res, next) => {
  try {
    const bugun = new Date();
    const altiAy = new Date(bugun); altiAy.setMonth(altiAy.getMonth() + 6);
    const birYil = new Date(bugun); birYil.setFullYear(birYil.getFullYear() + 1);

    const [toplam, aktif, vasifUyari, tahsisUyari] = await Promise.all([
      Mera.countDocuments({ durum: 'Aktif' }),
      Mera.countDocuments({ durum: 'Aktif' }),
      Mera.countDocuments({ durum: 'Aktif', vasif_bitis: { $lt: altiAy, $gt: bugun } }),
      Mera.countDocuments({ durum: 'Aktif', tahsis_durumu_bitis: { $lt: birYil, $gt: bugun } }),
    ]);

    // Toplam hektar ve otlatma kapasitesi (sadece aktif meralar)
    const aktifMeralar = await Mera.find({ durum: 'Aktif' }).select('tapu_alani_da otlatma');
    const toplamHektar = aktifMeralar.reduce((sum, m) => sum + (m.tapu_alani_da || 0), 0) / 10; // da → ha
    const toplamBbhb = aktifMeralar.reduce((sum, m) => sum + (m.otlatma?.otlatma_kapasitesi_bbhb || 0), 0);

    const vasifUyarilar = await Mera.find({ durum: 'Aktif', vasif_bitis: { $lt: altiAy, $gt: bugun } })
      .select('il_ad ilce_ad mahalle_ad ada parsel vasif vasif_bitis').limit(10);
    const tahsisUyarilar = await Mera.find({ durum: 'Aktif', tahsis_durumu_bitis: { $lt: birYil, $gt: bugun } })
      .select('il_ad ilce_ad mahalle_ad ada parsel tahsis_durumu tahsis_durumu_bitis').limit(10);

    res.json({ success: true, data: {
      toplam, aktif, pasif: 0,
      toplam_hektar: parseFloat(toplamHektar.toFixed(2)),
      toplam_bbhb: parseFloat(toplamBbhb.toFixed(2)),
      vasif_uyari: vasifUyari, tahsis_uyari: tahsisUyari,
      vasif_uyarilar, tahsis_uyarilar
    }});
  } catch (err) { next(err); }
};

module.exports = {
  listele, getById, olustur, guncelle, sil,
  kmlYukle: [upload.single('kml'), kmlYukle],
  kmlGetir,
  notEkle, notGuncelle, notSil,
  dosyaYukle: [upload.single('dosya'), dosyaYukle],
  dosyaSil,
  vasifDosyaYukle: [upload.single('dosya'), vasifDosyaYukle],
  tahsisDosyaYukle: [upload.single('dosya'), tahsisDosyaYukle],
  istatistik,
  pdfRapor,
  hesaplaOtlatma,
};
