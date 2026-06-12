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
      'ada','parsel','tapu_alani_da','nitelik','vasif','toprak_sinifi','durum','aciklama'];
    guncellenecek.forEach(alan => { if (req.body[alan] !== undefined) mera[alan] = req.body[alan]; });

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

    // KMZ ise aç
    if (req.file.originalname.toLowerCase().endsWith('.kmz')) {
      const JSZip = require('jszip');
      const zip = await JSZip.loadAsync(kmlBuffer);
      const kmlFile = Object.keys(zip.files).find(f => f.endsWith('.kml'));
      if (!kmlFile) return res.status(400).json({ success: false, message: 'KMZ içinde KML bulunamadı' });
      kmlBuffer = Buffer.from(await zip.files[kmlFile].async('arraybuffer'));
      mimeType = 'application/vnd.google-earth.kml+xml';
    }

    // Drive'a yükle
    const drive = await getDriveClient();
    const dosyaAdi = `${mera.ada || '0'}-${mera.parsel}-parsel.kml`;
    const folderId = await getMisDriveFolder(drive, [mera.il_ad, mera.ilce_ad, mera.mahalle_ad, `${mera.ada || '0'}-${mera.parsel}`]);
    const driveData = await driveYukle(drive, folderId, dosyaAdi, mimeType, kmlBuffer);

    mera.kml_drive_file_id = driveData.id;
    mera.kml_drive_web_link = driveData.webViewLink;
    mera.kml_drive_download_link = `https://drive.google.com/uc?export=download&id=${driveData.id}`;
    await mera.save();

    res.json({ success: true, data: { file_id: driveData.id, web_link: driveData.webViewLink, download_link: mera.kml_drive_download_link } });
  } catch (err) { next(err); }
};

const kmlGetir = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id).select('kml_drive_file_id kml_drive_download_link');
    if (!mera?.kml_drive_file_id) return res.status(404).json({ success: false, message: 'KML bulunamadı' });
    const drive = await getDriveClient();
    const response = await drive.files.get({ fileId: mera.kml_drive_file_id, alt: 'media' }, { responseType: 'arraybuffer' });
    res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="parsel.kml"');
    res.send(Buffer.from(response.data));
  } catch (err) { next(err); }
};

// ── Not CRUD ──────────────────────────────────────────────
const notEkle = async (req, res, next) => {
  try {
    const mera = await Mera.findById(req.params.id);
    if (!mera) return res.status(404).json({ success: false, message: 'Mera bulunamadı' });
    const { icerik, renk, renk_adi, metin_rengi } = req.body;
    mera.notlar.push({ icerik, renk: renk || '#0d6efd', renk_adi: renk_adi || 'Bilgi', metin_rengi: metin_rengi || '#fff' });
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

    const { kategori, ad } = req.body;
    const tarih = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const dosyaAdi = `${tarih}-${(kategori || 'diger').replace(/\s/g,'-')}-${ad || req.file.originalname}`;
    const ext = path.extname(req.file.originalname);
    const temizAd = dosyaAdi.endsWith(ext) ? dosyaAdi : dosyaAdi + ext;

    // Görsel sıkıştır
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

    mera.dosyalar.push({
      ad: temizAd, kategori,
      drive_file_id: driveData.id,
      drive_web_link: driveData.webViewLink,
      drive_download_link: `https://drive.google.com/uc?export=download&id=${driveData.id}`,
      boyut: buffer.length,
      mime_type: mimeType,
    });
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
    const fmt = (n) => n != null ? n.toLocaleString('tr-TR') : '-';

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>Mera Raporu - ${mera.il_ad}/${mera.mahalle_ad} Ada:${mera.ada} Parsel:${mera.parsel}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap');
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Noto Sans',Arial,sans-serif;font-size:11pt;color:#222;padding:15mm;}
    h1{font-size:14pt;text-align:center;margin-bottom:6mm;color:#0F6E56;}
    h2{font-size:11pt;color:#0F6E56;margin:5mm 0 3mm;border-bottom:1px solid #9FE1CB;padding-bottom:2mm;}
    table{width:100%;border-collapse:collapse;margin-bottom:4mm;font-size:10pt;}
    th{background:#0F6E56;color:#fff;padding:4pt 8pt;text-align:left;}
    td{padding:3pt 8pt;border-bottom:1px solid #eee;}
    .label{color:#666;width:35%;}
    .val{font-weight:500;}
    .footer{margin-top:8mm;font-size:9pt;color:#aaa;text-align:center;border-top:1px solid #ddd;padding-top:3mm;}
    @media print{.no-print{display:none;}}
  </style>
</head>
<body>
  <div class="no-print" style="text-align:center;margin-bottom:6mm;">
    <button onclick="window.print()" style="background:#0F6E56;color:#fff;border:none;padding:7px 22px;border-radius:6px;font-size:11pt;cursor:pointer;">PDF Olarak Yazdır / Kaydet</button>
  </div>
  <h1>MERA PARSEL RAPORU</h1>
  <h2>Konum Bilgileri</h2>
  <table><tbody>
    <tr><td class="label">İl</td><td class="val">${mera.il_ad}</td><td class="label">İlçe</td><td class="val">${mera.ilce_ad}</td></tr>
    <tr><td class="label">Mahalle/Köy</td><td class="val">${mera.mahalle_ad}</td><td class="label">Ada</td><td class="val">${mera.ada||'-'}</td></tr>
    <tr><td class="label">Parsel</td><td class="val">${mera.parsel}</td><td class="label">Tapu Alanı</td><td class="val">${fmt(mera.tapu_alani_da)} da</td></tr>
    <tr><td class="label">Nitelik</td><td class="val">${mera.nitelik||'-'}</td><td class="label">Durum</td><td class="val">${mera.durum}</td></tr>
    <tr><td class="label">Vasıf</td><td class="val">${mera.vasif||'-'}</td><td class="label">Toprak Sınıfı</td><td class="val">${mera.toprak_sinifi||'-'}</td></tr>
  </tbody></table>
  ${o ? `
  <h2>Otlatma Kapasitesi</h2>
  <table><tbody>
    <tr><td class="label">Yağış Kuşağı</td><td class="val">${o.kusak} mm</td><td class="label">Vasıf</td><td class="val">${o.vasif}</td></tr>
    <tr><td class="label">Alan</td><td class="val">${fmt(o.alan_da)} da</td><td class="label">Otlatma Kap.</td><td class="val">${fmt(o.otlatma_kapasitesi_bbhb)} BBHB</td></tr>
    <tr><td class="label">Yar. Yeşil Ot</td><td class="val">${fmt(o.yararlanilabilir_yesil_ot_kg)} kg / ${fmt(o.yararlanilabilir_yesil_ot_ton)} ton</td>
        <td class="label">180 Günlük Hayvan</td><td class="val">${fmt(o.hayvan_sayisi_180gun)} baş</td></tr>
    <tr><td class="label">Üretilen Yeşil Ot</td><td class="val">${fmt(o.uretilen_yesil_ot_kg)} kg / ${fmt(o.uretilen_yesil_ot_ton)} ton</td>
        <td class="label">Üretilen Kuru Ot</td><td class="val">${fmt(o.uretilen_kuru_ot_kg)} kg / ${fmt(o.uretilen_kuru_ot_ton)} ton</td></tr>
  </tbody></table>` : ''}
  ${mera.notlar?.length ? `
  <h2>Notlar</h2>
  <table><tbody>
    ${mera.notlar.filter(n=>n.icerik!=='[SİLİNDİ]').map(n=>`
    <tr><td style="width:25%;color:#666;font-size:9pt">${new Date(n.createdAt).toLocaleString('tr-TR')}</td>
    <td><span style="background:${n.renk};color:${n.metin_rengi};padding:1px 8px;border-radius:10px;font-size:9pt">${n.renk_adi}</span></td>
    <td>${n.icerik}</td></tr>`).join('')}
  </tbody></table>` : ''}
  <div class="footer">MİS - Mera İzleme Sistemi &nbsp;|&nbsp; ${new Date().toLocaleString('tr-TR')}</div>
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
    const folderId = await getMisDriveFolder(drive, [mera.il_ad, mera.ilce_ad, mera.mahalle_ad, `${mera.ada||'0'}-${mera.parsel}`, 'Vasıf']);
    const driveData = await driveYukle(drive, folderId, `${tarihStr}-vasif-belgesi${path.extname(req.file.originalname)}`, req.file.mimetype, req.file.buffer);

    if (vasif) mera.vasif = vasif;
    mera.vasif_tarih = tarihObj;
    mera.vasif_bitis = bitisTarihi;
    mera.vasif_dosya_id = driveData.id;
    mera.vasif_dosya_link = driveData.webViewLink;
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
    const folderId = await getMisDriveFolder(drive, [mera.il_ad, mera.ilce_ad, mera.mahalle_ad, `${mera.ada||'0'}-${mera.parsel}`, 'Tahsis']);
    const driveData = await driveYukle(drive, folderId, `${tarihStr}-tahsis-belgesi${path.extname(req.file.originalname)}`, req.file.mimetype, req.file.buffer);

    if (tahsis_durumu) mera.tahsis_durumu = tahsis_durumu;
    mera.tahsis_durumu_tarih = tarihObj;
    mera.tahsis_durumu_bitis = bitisTarihi;
    mera.tahsis_durumu_dosya_id = driveData.id;
    mera.tahsis_durumu_dosya_link = driveData.webViewLink;
    await mera.save();
    res.json({ success: true, data: { tahsis_durumu: mera.tahsis_durumu, tarih: mera.tahsis_durumu_tarih, bitis: mera.tahsis_durumu_bitis, link: driveData.webViewLink } });
  } catch (err) { next(err); }
};

// ── İstatistik ────────────────────────────────────────────
const istatistik = async (req, res, next) => {
  try {
    const bugun = new Date();
    const altıAy = new Date(bugun); altıAy.setMonth(altıAy.getMonth() + 6);
    const birYil = new Date(bugun); birYil.setFullYear(birYil.getFullYear() + 1);

    const [toplam, aktif, vasifUyari, tahsisUyari] = await Promise.all([
      Mera.countDocuments(),
      Mera.countDocuments({ durum: 'Aktif' }),
      Mera.countDocuments({ vasif_bitis: { $lt: altıAy, $gt: bugun } }),
      Mera.countDocuments({ tahsis_durumu_bitis: { $lt: birYil, $gt: bugun } }),
    ]);

    const vasifUyarilar = await Mera.find({ vasif_bitis: { $lt: altıAy, $gt: bugun } })
      .select('il_ad ilce_ad mahalle_ad ada parsel vasif vasif_bitis').limit(10);
    const tahsisUyarilar = await Mera.find({ tahsis_durumu_bitis: { $lt: birYil, $gt: bugun } })
      .select('il_ad ilce_ad mahalle_ad ada parsel tahsis_durumu tahsis_durumu_bitis').limit(10);

    res.json({ success: true, data: { toplam, aktif, pasif: toplam - aktif, vasif_uyari: vasifUyari, tahsis_uyari: tahsisUyari, vasif_uyarilar, tahsis_uyarilar } });
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
