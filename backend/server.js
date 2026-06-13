require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const bbhbRoutes = require('./modules/bbhb/bbhb.routes');
const bbhbYukleRoutes = require('./modules/bbhb-yukle/bbhbYukle.routes');
const ayarlarRoutes = require('./modules/ayarlar/ayarlar.routes');
const meraRoutes = require('./modules/mera/mera.routes');
const isgalRoutes = require('./modules/isgal/isgal.routes');
const fs = require('fs');

const app = express();

// Upload tmp klasörü
['/tmp/mis_uploads', '/tmp/mis_yukle'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

connectDB().then(async () => {
  // İdari veri yoksa XML'den yükle
  const Idari = require('./modules/idari/idari.model');
  const count = await Idari.countDocuments();
  if (count === 0) {
    console.log('İdari veri yükleniyor...');
    try {
      const xml2js = require('xml2js');
      const xmlContent = require('fs').readFileSync(
        require('path').join(__dirname, 'data/Il-ilce-Semt-Mahalle-PostaKodu.xml'), 'utf8'
      );
      const result = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });
      const root = result.turkiye;
      const iller = {}, ilceler = {}, semtler = {};
      const ilArray = Array.isArray(root.tbl_il) ? root.tbl_il : [root.tbl_il];
      const ilcArray = Array.isArray(root.tbl_ilce) ? root.tbl_ilce : [root.tbl_ilce];
      const semtArray = Array.isArray(root.tbl_semt) ? root.tbl_semt : [root.tbl_semt];
      const mahArray = Array.isArray(root.tbl_mahalle) ? root.tbl_mahalle : [root.tbl_mahalle];
      ilArray.forEach(il => iller[il.il_id] = il.il_ad);
      ilcArray.forEach(ilce => ilceler[ilce.ilce_id] = { ad: ilce.ilce_ad, il_id: ilce.il_id });
      semtArray.forEach(s => semtler[s.semt_id] = s.ilce_id);
      const ilDocs = ilArray.map(il => ({ tip: 'il', ad: il.il_ad, il_id: il.il_id, xml_id: il.il_id }));
      const ilcDocs = ilcArray.map(ilce => ({ tip: 'ilce', ad: ilce.ilce_ad, il_id: ilce.il_id, il_ad: iller[ilce.il_id] || '', ilce_id: ilce.ilce_id, xml_id: ilce.ilce_id }));
      const mahDocs = [];
      mahArray.forEach(m => {
        const ilce_id = semtler[m.semt_id]; if (!ilce_id) return;
        const ilce = ilceler[ilce_id]; if (!ilce) return;
        mahDocs.push({ tip: 'mahalle', ad: m.mahalle_ad, il_id: ilce.il_id, il_ad: iller[ilce.il_id] || '', ilce_id, ilce_ad: ilce.ad, xml_id: m.mahalle_id });
      });
      await Idari.insertMany(ilDocs);
      await Idari.insertMany(ilcDocs);
      const BATCH = 5000;
      for (let i = 0; i < mahDocs.length; i += BATCH) await Idari.insertMany(mahDocs.slice(i, i + BATCH));
      console.log(`İdari veri yüklendi: ${ilDocs.length} il, ${ilcDocs.length} ilçe, ${mahDocs.length} mahalle`);
    } catch (e) { console.error('İdari veri yükleme hatası:', e.message); }
  }
});

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MİS API çalışıyor', version: '1.0.0' });
});

app.use('/api/bbhb', bbhbRoutes);
app.use('/api/bbhb-yukle', bbhbYukleRoutes);
app.use('/api/ayarlar', ayarlarRoutes);
app.use('/api/mera', meraRoutes);
app.use('/api/isgal', isgalRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.BACKEND_PORT || 5000;
app.listen(PORT, () => {
  console.log(`MİS Backend ${PORT} portunda çalışıyor [${process.env.NODE_ENV}]`);
});
