const mongoose = require('mongoose');

const SurumSchema = new mongoose.Schema({
  icerik: { type: String },
  html_icerik: { type: String },
  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },
  degisiklik_notu: { type: String },
  kontrol_tarihi: { type: Date },
  kaynak_hash: { type: String },
}, { timestamps: true });

const NotSchema = new mongoose.Schema({
  icerik: { type: String, required: true },
  madde_ref: { type: String },   // İlgili madde/bölüm referansı (opsiyonel)
  renk: { type: String, default: '#FFF9C4' },
  renk_adi: { type: String, default: 'Sarı' },
  metin_rengi: { type: String, default: '#333333' },
}, { timestamps: true });

const MevzuatSchema = new mongoose.Schema({
  ad: { type: String, required: true },
  tur: {
    type: String,
    enum: ['Kanun', 'Yönetmelik', 'Tebliğ', 'Genelge', 'Yönerge', 'Karar', 'Diğer'],
    required: true,
  },
  resmi_gazete_tarihi: { type: Date },
  resmi_gazete_sayisi: { type: String },
  mevzuat_no: { type: String },
  konu: { type: String },
  etiketler: [{ type: String }],

  icerik_tipi: {
    type: String,
    enum: ['pdf', 'metin', 'link', 'mevzuat_gov'],
    required: true,
  },

  icerik: { type: String },
  html_icerik: { type: String },
  harici_link: { type: String },
  mevzuat_gov_url: { type: String },

  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },

  kaynak_hash: { type: String },
  son_kontrol: { type: Date },
  guncelleme_bekleniyor: { type: Boolean, default: false },
  guncelleme_tarihi: { type: Date },

  notlar: [NotSchema],
  surumler: [SurumSchema],

  aktif: { type: Boolean, default: true },
}, { timestamps: true });

MevzuatSchema.index({ tur: 1 });
MevzuatSchema.index({ mevzuat_no: 1 });
MevzuatSchema.index({ guncelleme_bekleniyor: 1 });
// Metin araması için
MevzuatSchema.index({ ad: 'text', icerik: 'text', konu: 'text', 'notlar.icerik': 'text', etiketler: 'text' });

module.exports = mongoose.model('Mevzuat', MevzuatSchema);
