const mongoose = require('mongoose');

// ── Tahsis No üretici ────────────────────────────────────
// Format: TAH-YY-NNNN (örn. TAH-26-0001)
const SayacSchema = new mongoose.Schema({
  yil: { type: Number, required: true, unique: true },
  son: { type: Number, default: 0 },
});
const TahsisSayac = mongoose.models.TahsisSayac || mongoose.model('TahsisSayac', SayacSchema);

const tahsisNoUret = async () => {
  const yil = new Date().getFullYear() % 100;
  const sayac = await TahsisSayac.findOneAndUpdate(
    { yil },
    { $inc: { son: 1 } },
    { upsert: true, new: true }
  );
  return `TAH-${String(yil).padStart(2,'0')}-${String(sayac.son).padStart(4,'0')}`;
};

// ── Parsel (mera) alt belgesi ────────────────────────────
const ParselSchema = new mongoose.Schema({
  mera_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Mera' },
  il_ad:        { type: String },
  ilce_ad:      { type: String },
  mahalle_ad:   { type: String },
  ada:          { type: String },
  parsel:       { type: String },
  tapu_alani_da:{ type: Number },
  vasif:        { type: String },
  kaynak:       { type: String },  // 5/a, 5/b vs
  dahil:        { type: Boolean, default: true }, // tahsise dahil mi
  aciklama:     { type: String },
});

// ── BBHB bağlantısı ──────────────────────────────────────
const BbhbBaglantiSchema = new mongoose.Schema({
  bbhb_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'BBHBHesaplama' },
  toplam_bbhb:  { type: Number },
  toplam_adet:  { type: Number },
  il:           { type: String },
  ilce:         { type: String },
  mahalle:      { type: String },
  tarih:        { type: Date },
  aciklama:     { type: String },
});

// ── Adım / Süreç ─────────────────────────────────────────
const AdimSchema = new mongoose.Schema({
  adim_kodu:    { type: String, required: true },
  ad:           { type: String },
  tarih:        { type: Date },
  aciklama:     { type: String },
  dosyalar:     [{
    ad:         { type: String },
    drive_file_id:  { type: String },
    drive_link: { type: String },
    yukleme_tarihi: { type: Date, default: Date.now },
  }],
  tamamlandi:   { type: Boolean, default: false },
  tamamlanma_tarihi: { type: Date },
}, { _id: true });

// ── Ana Tahsis Şeması ─────────────────────────────────────
const TahsisSchema = new mongoose.Schema({
  tahsis_no:      { type: String, unique: true },

  // Coğrafi kapsam
  il_ad:          { type: String, required: true },
  ilce_ad:        { type: String },
  mahalle_ad:     { type: String },

  // Başvuru / Talep Sahibi
  talep_sahibi:   { type: String },   // Kurum/kişi adı
  talep_tarihi:   { type: Date },
  talep_amaci:    { type: String },   // Kullanım amacı

  // Kapsam
  parseller:      { type: [ParselSchema], default: [] },
  toplam_alan_da: { type: Number, default: 0 },

  // BBHB bağlantısı
  bbhb_baglantilari: { type: [BbhbBaglantiSchema], default: [] },

  // Süreç adımları
  adimlar:        { type: [AdimSchema], default: [] },
  aktif_adim:     { type: String, default: 'basvuru' },

  // Genel
  durum:          {
    type: String,
    enum: ['taslak','devam','tamamlandi','iptal','reddedildi'],
    default: 'taslak',
  },
  aciklama:       { type: String },
  notlar:         [{ icerik: String, tarih: { type: Date, default: Date.now }, renk: String }],

}, { timestamps: true });

// Otomatik tahsis_no
TahsisSchema.pre('save', async function(next) {
  if (!this.tahsis_no) this.tahsis_no = await tahsisNoUret();
  next();
});

// Toplam alanı hesapla
TahsisSchema.pre('save', function(next) {
  this.toplam_alan_da = this.parseller
    .filter(p => p.dahil !== false)
    .reduce((s, p) => s + (p.tapu_alani_da || 0), 0);
  next();
});

TahsisSchema.index({ il_ad: 1, ilce_ad: 1, mahalle_ad: 1 });
TahsisSchema.index({ durum: 1 });
TahsisSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Tahsis', TahsisSchema);
