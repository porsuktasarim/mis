const mongoose = require('mongoose');

const SurumSchema = new mongoose.Schema({
  icerik: { type: String },           // Metin içeriği
  html_icerik: { type: String },      // HTML içeriği (mevzuat.gov.tr'den)
  drive_file_id: { type: String },    // PDF Drive ID
  drive_web_link: { type: String },
  drive_download_link: { type: String },
  degisiklik_notu: { type: String },  // Bu sürümdeki değişiklik
  kontrol_tarihi: { type: Date },
  kaynak_hash: { type: String },      // Değişiklik tespiti için hash
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
  mevzuat_no: { type: String },       // Kanun numarası (4342 gibi)
  konu: { type: String },
  etiketler: [{ type: String }],

  // İçerik tipi
  icerik_tipi: {
    type: String,
    enum: ['pdf', 'metin', 'link', 'mevzuat_gov'],
    required: true,
  },

  // Aktif içerik
  icerik: { type: String },           // Metin içeriği
  html_icerik: { type: String },      // HTML içeriği
  harici_link: { type: String },      // Harici bağlantı
  mevzuat_gov_url: { type: String },  // mevzuat.gov.tr URL'i

  // PDF
  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },

  // Değişiklik takibi
  kaynak_hash: { type: String },
  son_kontrol: { type: Date },
  guncelleme_bekleniyor: { type: Boolean, default: false },
  guncelleme_tarihi: { type: Date },

  // Sürüm geçmişi
  surumler: [SurumSchema],

  aktif: { type: Boolean, default: true },
}, { timestamps: true });

MevzuatSchema.index({ tur: 1 });
MevzuatSchema.index({ mevzuat_no: 1 });
MevzuatSchema.index({ guncelleme_bekleniyor: 1 });

module.exports = mongoose.model('Mevzuat', MevzuatSchema);
