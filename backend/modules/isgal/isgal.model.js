const mongoose = require('mongoose');

const DosyaSchema = new mongoose.Schema({
  ad: { type: String },
  adim_id: { type: mongoose.Schema.Types.ObjectId },
  adim_tip: { type: String },
  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },
  mime_type: { type: String },
  boyut: { type: Number },
  yukleme_tarihi: { type: Date, default: Date.now },
});

const AdimSchema = new mongoose.Schema({
  sira: { type: Number },
  tip: {
    type: String,
    enum: [
      'tespit_tutanak',
      'komisyon_intikal',
      'komisyon_karar',
      'ucuncu_yol_3091',
      'uc_bin_doksan_bir_sonuc',
      'iki_bin_sekiz_yuz_seksen_alti',
      'dava_men_mudahale',
      'suc_duyurusu',
      'eski_hale_getirme',
      'tazminat_davasi',
      'sonuc',
      'diger',
    ],
    required: true,
  },
  aciklama: { type: String, required: true },
  tarih: { type: Date, default: Date.now },
  sure_bitis: { type: Date },
  sorumlu: { type: String },
  tamamlandi: { type: Boolean, default: false },
  dosyalar: [DosyaSchema],
}, { timestamps: true });

const KmlSchema = new mongoose.Schema({
  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },
  dosya_adi: { type: String },
  renk: { type: String, default: '#FF0000' },
  yukleme_tarihi: { type: Date, default: Date.now },
});

const IsgalSchema = new mongoose.Schema({
  mera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Mera', required: true },
  mera_il_ad: { type: String },
  mera_ilce_ad: { type: String },
  mera_mahalle_ad: { type: String },
  mera_ada: { type: String },
  mera_parsel: { type: String },
  mera_nitelik: { type: String },

  isgal_no: { type: String },        // sistem tarafından verilen (A-Z, 0-9, tire)
  kullanici_no: { type: String },    // kullanıcı tarafından eklenen

  tespit_sekli: { type: String, enum: ['teknik_ekip', 'sikayet', 'ihbar'], required: true },
  tespit_tarihi: { type: Date, required: true },
  tespit_eden: { type: String },
  isgal_tarihi: { type: Date },

  isgal_turu: { type: String, enum: ['tarla_isgali', 'yapilasma', 'yol_hafriyat'], required: true },
  isgal_turu_aciklama: { type: String, required: true },
  isgal_alani_m2: { type: Number },

  isgalci_ad_soyad: { type: String },
  isgalci_tc: { type: String },
  isgalci_adres: { type: String },

  komisyon_karar_tipi: { type: String, enum: ['dava', '3091', 'belirsiz', ''], default: '' },

  // Aktif süreç adımı
  aktif_adim: { type: String },

  durum: { type: String, enum: ['aktif', 'cozuldu', 'mahkemede', 'arsiv'], default: 'aktif' },

  adimlar: [AdimSchema],
  kml_katmanlar: [KmlSchema],
  mahkeme_id: { type: mongoose.Schema.Types.ObjectId },
  aciklama: { type: String },
}, { timestamps: true });

IsgalSchema.index({ mera_id: 1 });
IsgalSchema.index({ durum: 1 });
IsgalSchema.index({ tespit_tarihi: -1 });

module.exports = mongoose.model('Isgal', IsgalSchema);
