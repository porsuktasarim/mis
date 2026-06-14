const mongoose = require('mongoose');

// Google Drive hesapları
const DriveHesapSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  aciklama: { type: String },
  tip: { type: String, enum: ['service_account', 'oauth2'], default: 'service_account' },
  service_account_json: { type: mongoose.Schema.Types.Mixed },
  oauth_client_json: { type: mongoose.Schema.Types.Mixed },
  oauth_token: { type: mongoose.Schema.Types.Mixed },
  email: { type: String },
  aktif: { type: Boolean, default: true },
  kota_kullanilan: { type: Number, default: 0 },
  kota_toplam: { type: Number, default: 15 * 1024 },
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

// Teknik ekip üyesi
const TeknikEkipUyeSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  kurum: { type: String },
  unvan: { type: String },
  asil_yedek: { type: String, enum: ['asil', 'yedek'], default: 'asil' },
  aktif: { type: Boolean, default: true },
  sira: { type: Number, default: 0 },
});

// İl mera komisyonu üyesi
const KomisyonUyeSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  kurum: { type: String },
  unvan: { type: String },
  asil_yedek: { type: String, enum: ['asil', 'yedek'], default: 'asil' },
  aktif: { type: Boolean, default: true },
  sira: { type: Number, default: 0 },
});

// Kullanıcı (ileride aktifleştirilecek)
const KullaniciSchema = new mongoose.Schema({
  ad: { type: String },
  eposta: { type: String },
  sifre_hash: { type: String },
  rol: { type: String, enum: ['admin', 'kullanici'], default: 'kullanici' },
  aktif: { type: Boolean, default: false },
}, { timestamps: true });

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
  // Personel
  teknik_ekip_ad: { type: String, default: 'Teknik Ekip' },
  teknik_ekip: [TeknikEkipUyeSchema],
  komisyon_uyeleri: [KomisyonUyeSchema],
  kullanicilar: [KullaniciSchema],
}, { timestamps: true });

module.exports = mongoose.model('Ayarlar', AyarlarSchema);
