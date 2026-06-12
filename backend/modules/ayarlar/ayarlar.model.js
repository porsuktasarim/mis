const mongoose = require('mongoose');

// Google Drive hesapları
const DriveHesapSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  aciklama: { type: String },
  service_account_json: { type: mongoose.Schema.Types.Mixed },
  email: { type: String },
  aktif: { type: Boolean, default: true },
  kota_kullanilan: { type: Number, default: 0 },
  kota_toplam: { type: Number, default: 15 * 1024 }, // MB
}, { timestamps: true });

// Dosya kategorileri
const DosyaKategoriSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  ikon: { type: String, default: 'bi-file-earmark' },
  sira: { type: Number, default: 0 },
  aktif: { type: Boolean, default: true },
});

// Not renkleri
const NotRenkSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  renk: { type: String, required: true },
  metin_rengi: { type: String, default: '#fff' },
  sira: { type: Number, default: 0 },
});

// Toprak sınıfları
const ToprakSinifiSchema = new mongoose.Schema({
  sinif: { type: String, required: true },
  ad: { type: String },
  tanim: { type: String },
  sira: { type: Number, default: 0 },
});

// Yağış kuşakları (il bazlı)
const YagisKusagiSchema = new mongoose.Schema({
  il_id: { type: String, required: true },
  il_ad: { type: String, required: true },
  kusak: { type: String, required: true }, // '200-350', '350-500' vb.
});

// Otlatma verim tablosu satırı
const VerimSatirSchema = new mongoose.Schema({
  kusak: { type: String, required: true },
  cok_iyi: { type: Number },
  iyi: { type: Number },
  orta: { type: Number },
  zayif: { type: Number },
});

// İdari öncelik (ana sayfada öne çıkan iller)
const IdariOncelikSchema = new mongoose.Schema({
  sira: { type: Number, required: true },
  il_id: { type: String, required: true },
  il_ad: { type: String, required: true },
});

const AyarlarSchema = new mongoose.Schema({
  drive_hesaplari: [DriveHesapSchema],
  dosya_kategorileri: [DosyaKategoriSchema],
  not_renkleri: [NotRenkSchema],
  toprak_siniflari: [ToprakSinifiSchema],
  yagis_kusaklari: [YagisKusagiSchema],
  yararlanilabilir_yesil_ot: [VerimSatirSchema],
  uretilen_yesil_ot: [VerimSatirSchema],
  uretilen_kuru_ot: [VerimSatirSchema],
  idari_oncelikler: [IdariOncelikSchema],
}, { timestamps: true });

module.exports = mongoose.model('Ayarlar', AyarlarSchema);
