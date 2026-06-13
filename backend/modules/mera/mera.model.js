const mongoose = require('mongoose');

const NotSchema = new mongoose.Schema({
  icerik: { type: String, required: true },
  renk: { type: String, default: '#0d6efd' },
  renk_adi: { type: String, default: 'Bilgi' },
  metin_rengi: { type: String, default: '#fff' },
  olusturan: { type: String, default: 'Sistem' },
  dosya_id: { type: mongoose.Schema.Types.ObjectId }, // bağlı dosya
  duzenlemeler: [{
    eski_icerik: { type: String },
    tarih: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

const DosyaSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  kategori: { type: String },
  kaynak: { type: String, enum: ['dosyalar', 'kml', 'vasif', 'tahsis'], default: 'dosyalar' },
  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },
  boyut: { type: Number },
  mime_type: { type: String },
  not_icerik: { type: String }, // yükleme sırasında eklenen not
  yukleme_tarihi: { type: Date, default: Date.now },
}, { timestamps: true });

const KmlGecmisSchema = new mongoose.Schema({
  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },
  dosya_adi: { type: String },
  surum: { type: String },
  yukleme_tarihi: { type: Date, default: Date.now },
});

const OtlatmaSchema = new mongoose.Schema({
  kusak: { type: String },
  vasif: { type: String },
  alan_da: { type: Number },
  yararlanilabilir_yesil_ot_kg: { type: Number },
  yararlanilabilir_yesil_ot_ton: { type: Number },
  uretilen_yesil_ot_kg: { type: Number },
  uretilen_yesil_ot_ton: { type: Number },
  uretilen_kuru_ot_kg: { type: Number },
  uretilen_kuru_ot_ton: { type: Number },
  otlatma_kapasitesi_bbhb: { type: Number },
  hayvan_sayisi_180gun: { type: Number },
  hesaplama_tarihi: { type: Date, default: Date.now },
});

const MeraSchema = new mongoose.Schema({
  // Konum
  il_id: { type: String },
  il_ad: { type: String, required: true },
  ilce_id: { type: String },
  ilce_ad: { type: String, required: true },
  mahalle_id: { type: String },
  mahalle_ad: { type: String, required: true },
  ada: { type: String },
  parsel: { type: String, required: true },
  tapu_alani_da: { type: Number },

  // Nitelik
  nitelik: { type: String },
  nitelik_diger: { type: String },
  vasif: { type: String, enum: ['Çok İyi', 'İyi', 'Orta', 'Zayıf', 'Bilinmiyor'], default: 'Bilinmiyor' },
  vasif_tarih: { type: Date },
  vasif_bitis: { type: Date },
  vasif_dosya_id: { type: String },
  vasif_dosya_link: { type: String },
  toprak_sinifi: { type: String },
  toprak_sinifi_tanim: { type: String },

  // Durum
  durum: { type: String, enum: ['Aktif', 'Pasif'], default: 'Aktif' },
  tahsis_durumu: { type: String, default: '' },
  tahsis_durumu_tarih: { type: Date },
  tahsis_durumu_bitis: { type: Date },
  tahsis_durumu_dosya_id: { type: String },
  tahsis_durumu_dosya_link: { type: String },
  tahsis_amaci: { type: String, default: '' },

  // Harita - aktif KML
  kml_drive_file_id: { type: String },
  kml_drive_web_link: { type: String },
  kml_drive_download_link: { type: String },
  kml_gecmis: [KmlGecmisSchema],
  kml_alan_m2: { type: Number },
  kml_koordinatlar: { type: mongoose.Schema.Types.Mixed },

  // Otlatma kapasitesi
  otlatma: { type: OtlatmaSchema },

  // İlişkili kayıtlar
  tahsis_kayitlari: [{ type: mongoose.Schema.Types.ObjectId }],
  mahkeme_kayitlari: [{ type: mongoose.Schema.Types.ObjectId }],
  isgal_kayitlari: [{ type: mongoose.Schema.Types.ObjectId }],

  // Notlar
  notlar: [NotSchema],

  // Dosyalar (tüm dosyalar buraya - kaynak alanıyla ayrışır)
  dosyalar: [DosyaSchema],

  // Meta
  aciklama: { type: String },
}, { timestamps: true });

MeraSchema.index({ il_id: 1, ilce_id: 1 });
MeraSchema.index({ ada: 1, parsel: 1 });

module.exports = mongoose.model('Mera', MeraSchema);


const OtlatmaSchema = new mongoose.Schema({
  kusak: { type: String },
  vasif: { type: String },
  alan_da: { type: Number },
  yararlanilabilir_yesil_ot_kg: { type: Number },
  yararlanilabilir_yesil_ot_ton: { type: Number },
  uretilen_yesil_ot_kg: { type: Number },
  uretilen_yesil_ot_ton: { type: Number },
  uretilen_kuru_ot_kg: { type: Number },
  uretilen_kuru_ot_ton: { type: Number },
  otlatma_kapasitesi_bbhb: { type: Number },
  hayvan_sayisi_180gun: { type: Number },
  hesaplama_tarihi: { type: Date, default: Date.now },
});

const MeraSchema = new mongoose.Schema({
  // Konum
  il_id: { type: String },
  il_ad: { type: String, required: true },
  ilce_id: { type: String },
  ilce_ad: { type: String, required: true },
  mahalle_id: { type: String },
  mahalle_ad: { type: String, required: true },
  ada: { type: String },
  parsel: { type: String, required: true },
  tapu_alani_da: { type: Number },

  // Nitelik
  nitelik: { type: String },
  nitelik_diger: { type: String },
  vasif: { type: String, enum: ['Çok İyi', 'İyi', 'Orta', 'Zayıf', 'Bilinmiyor'], default: 'Bilinmiyor' },
  vasif_tarih: { type: Date },
  vasif_bitis: { type: Date },
  vasif_dosya_id: { type: String },
  vasif_dosya_link: { type: String },
  toprak_sinifi: { type: String },
  toprak_sinifi_tanim: { type: String },

  // Durum
  durum: { type: String, enum: ['Aktif', 'Pasif'], default: 'Aktif' },
  tahsis_durumu: { type: String, default: '' },
  tahsis_durumu_tarih: { type: Date },
  tahsis_durumu_bitis: { type: Date },
  tahsis_durumu_dosya_id: { type: String },
  tahsis_durumu_dosya_link: { type: String },
  tahsis_amaci: { type: String, default: '' },

  // Harita
  kml_drive_file_id: { type: String },
  kml_drive_web_link: { type: String },
  kml_drive_download_link: { type: String },
  kml_alan_m2: { type: Number },
  kml_koordinatlar: { type: mongoose.Schema.Types.Mixed },

  // Otlatma kapasitesi
  otlatma: { type: OtlatmaSchema },

  // İlişkili kayıtlar (diğer modüllerden gelecek)
  tahsis_kayitlari: [{ type: mongoose.Schema.Types.ObjectId }],
  mahkeme_kayitlari: [{ type: mongoose.Schema.Types.ObjectId }],
  isgal_kayitlari: [{ type: mongoose.Schema.Types.ObjectId }],

  // Notlar
  notlar: [NotSchema],

  // Dosyalar
  dosyalar: [DosyaSchema],

  // Meta
  aciklama: { type: String },
}, { timestamps: true });

MeraSchema.index({ il_id: 1, ilce_id: 1 });
MeraSchema.index({ ada: 1, parsel: 1 });

module.exports = mongoose.model('Mera', MeraSchema);
