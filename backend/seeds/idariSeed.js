require('dotenv').config();
const mongoose = require('mongoose');
const xml2js = require('xml2js');
const fs = require('fs');
const path = require('path');

const IdariSchema = new mongoose.Schema({
  tip: { type: String, enum: ['il', 'ilce', 'mahalle'], required: true },
  ad: { type: String, required: true },
  il_id: { type: String },
  il_ad: { type: String },
  ilce_id: { type: String },
  ilce_ad: { type: String },
  xml_id: { type: String },
}, { timestamps: false });

IdariSchema.index({ tip: 1, il_id: 1 });
IdariSchema.index({ tip: 1, ilce_id: 1 });

const IdariModel = mongoose.model('Idari', IdariSchema);

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB bağlandı');

  await IdariModel.deleteMany({});
  console.log('Mevcut veriler temizlendi');

  const xmlContent = fs.readFileSync(
    path.join(__dirname, '../data/Il-ilce-Semt-Mahalle-PostaKodu.xml'),
    'utf8'
  );

  const result = await xml2js.parseStringPromise(xmlContent, { explicitArray: false });
  const root = result.turkiye;

  // İller
  const iller = {};
  const ilArray = Array.isArray(root.tbl_il) ? root.tbl_il : [root.tbl_il];
  const ilDocs = ilArray.map(il => {
    iller[il.il_id] = il.il_ad;
    return { tip: 'il', ad: il.il_ad, il_id: il.il_id, xml_id: il.il_id };
  });
  await IdariModel.insertMany(ilDocs);
  console.log(`${ilDocs.length} il eklendi`);

  // İlçeler
  const ilceler = {};
  const ilceArray = Array.isArray(root.tbl_ilce) ? root.tbl_ilce : [root.tbl_ilce];
  const ilceDocs = ilceArray.map(ilce => {
    ilceler[ilce.ilce_id] = { ad: ilce.ilce_ad, il_id: ilce.il_id };
    return {
      tip: 'ilce', ad: ilce.ilce_ad,
      il_id: ilce.il_id, il_ad: iller[ilce.il_id] || '',
      ilce_id: ilce.ilce_id, xml_id: ilce.ilce_id
    };
  });
  await IdariModel.insertMany(ilceDocs);
  console.log(`${ilceDocs.length} ilçe eklendi`);

  // Semt → ilçe eşleşmesi
  const semtler = {};
  const semtArray = Array.isArray(root.tbl_semt) ? root.tbl_semt : [root.tbl_semt];
  semtArray.forEach(s => { semtler[s.semt_id] = s.ilce_id; });

  // Mahalleler (batch insert)
  const mahalleDocs = [];
  const mahalleArray = Array.isArray(root.tbl_mahalle) ? root.tbl_mahalle : [root.tbl_mahalle];

  for (const m of mahalleArray) {
    const ilce_id = semtler[m.semt_id];
    if (!ilce_id) continue;
    const ilce = ilceler[ilce_id];
    if (!ilce) continue;
    mahalleDocs.push({
      tip: 'mahalle', ad: m.mahalle_ad,
      il_id: ilce.il_id, il_ad: iller[ilce.il_id] || '',
      ilce_id, ilce_ad: ilce.ad,
      xml_id: m.mahalle_id
    });
  }

  // 5000'er batch
  const BATCH = 5000;
  for (let i = 0; i < mahalleDocs.length; i += BATCH) {
    await IdariModel.insertMany(mahalleDocs.slice(i, i + BATCH));
    process.stdout.write(`\r${Math.min(i + BATCH, mahalleDocs.length)}/${mahalleDocs.length} mahalle eklendi`);
  }
  console.log('\nTamamlandı!');
  await mongoose.disconnect();
};

run().catch(e => { console.error(e); process.exit(1); });
