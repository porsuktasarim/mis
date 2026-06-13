const mongoose = require('mongoose');

// Süreç adımı
const AdimSchema = new mongoose.Schema({
  tip: {
    type: String,
    enum: [
      'komisyon_intikal',      // Komisyona intikal
      'komisyon_karar',        // Komisyon kararı
      'ucuncu_yol_3091',       // 3091 - Kaymakamlık/Valilik yazısı
      'uc_bin_doksan_bir_sonuc', // 3091 sonucu
      'iki_bin_sekiz_yuz_seksen_alti', // 2886/75 - Jandarma/Kaymakamlık
      'dava_men_mudahale',     // Men-i müdahale ve kal davası
      'suc_duyurusu',          // Suç duyurusu (harman/sıvat/eğrek)
      'eski_hale_getirme',     // Eski hale getirme talebi
      'tazminat_davasi',       // Tazminat davası
      'sonuc',                 // Sonuç/Kapatma
      'diger',                 // Diğer
    ],
    required: true,
  },
  aciklama: { type: String, required: true },
  tarih: { type: Date, default: Date.now },
  sure_bitis: { type: Date }, // 3091 için 15 gün sayacı
  sorumlu: { type: String },  // Yazının gönderildiği kurum/kişi
  dosyalar: [{
    ad: { type: String },
    drive_file_id: { type: String },
    drive_web_link: { type: String },
    drive_download_link: { type: String },
    mime_type: { type: String },
    boyut: { type: Number },
    yukleme_tarihi: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// KML katmanı (her işgal için ayrı)
const KmlSchema = new mongoose.Schema({
  drive_file_id: { type: String },
  drive_web_link: { type: String },
  drive_download_link: { type: String },
  dosya_adi: { type: String },
  renk: { type: String, default: '#FF0000' }, // KML overlay rengi
  yukleme_tarihi: { type: Date, default: Date.now },
});

const IsgalSchema = new mongoose.Schema({
  // Bağlı mera
  mera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Mera', required: true },
  mera_il_ad: { type: String },
  mera_ilce_ad: { type: String },
  mera_mahalle_ad: { type: String },
  mera_ada: { type: String },
  mera_parsel: { type: String },

  // İşgal bilgileri
  isgal_no: { type: String }, // Otomatik sıra no
  tespit_sekli: {
    type: String,
    enum: ['teknik_ekip', 'sikayet', 'ihbar'],
    required: true,
  },
  tespit_tarihi: { type: Date, required: true },
  tespit_eden: { type: String },
  isgal_tarihi: { type: Date }, // İşgalin başladığı tarih (biliniyorsa)

  // İşgal türü
  isgal_turu: {
    type: String,
    enum: ['tarla_isgali', 'yapilasma', 'yol_hafriyat'],
    required: true,
  },
  isgal_turu_aciklama: { type: String, required: true },
  isgal_alani_m2: { type: Number }, // m² cinsinden

  // İşgalci bilgileri
  isgalci_ad_soyad: { type: String },
  isgalci_tc: { type: String },
  isgalci_adres: { type: String },

  // Nitelik (harman/sıvat/eğrek ise suç duyurusu otomatik uyarısı)
  mera_nitelik: { type: String }, // Mera'dan çekilir

  // Süreç
  komisyon_karar_tipi: {
    type: String,
    enum: ['dava', '3091', 'belirsiz', ''],
    default: '',
  },

  // Durum
  durum: {
    type: String,
    enum: ['aktif', 'cozuldu', 'mahkemede', 'arsiv'],
    default: 'aktif',
  },

  // Süreç adımları
  adimlar: [AdimSchema],

  // KML katmanları
  kml_katmanlar: [KmlSchema],

  // Bağlı mahkeme (ileride)
  mahkeme_id: { type: mongoose.Schema.Types.ObjectId },

  aciklama: { type: String },
}, { timestamps: true });

IsgalSchema.index({ mera_id: 1 });
IsgalSchema.index({ durum: 1 });
IsgalSchema.index({ tespit_tarihi: -1 });

module.exports = mongoose.model('Isgal', IsgalSchema);
