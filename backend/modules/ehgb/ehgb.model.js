const mongoose = require('mongoose');

// Yıllık birim fiyat parametreleri (ayarlardan yönetilir)
// Bu schema varsayılan - içerik netleşince genişletilecek
const EhgbParametreSchema = new mongoose.Schema({
  yil: { type: Number, required: true },
  aciklama: { type: String },
  // Hesaplama parametreleri buraya eklenecek
  parametreler: { type: mongoose.Schema.Types.Mixed, default: {} },
  guncelleme_tarihi: { type: Date, default: Date.now },
}, { timestamps: true });

// Hesaplama kaydı
const EhgbHesapSchema = new mongoose.Schema({
  // Bağlantılar
  isgal_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Isgal' },
  mera_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Mera' },

  // Parsel bilgileri (işgalden gelebilir veya manuel girilebilir)
  il_ad: { type: String },
  ilce_ad: { type: String },
  mahalle_ad: { type: String },
  ada: { type: String },
  parsel: { type: String },

  // İşgalci bilgileri
  isgalci_ad_soyad: { type: String },
  isgalci_tc: { type: String },
  isgalci_adres: { type: String },

  // İşgal bilgileri
  isgal_alani_m2: { type: Number },
  isgal_turu: { type: String },
  isgal_tarihi: { type: Date },

  // Hesaplama parametreleri
  karar_tarihi: { type: Date },  // Kaymakamlık/mahkeme kararı tarihi
  hesaplama_yili: { type: Number },
  kullanilan_parametreler: { type: mongoose.Schema.Types.Mixed },

  // Hesaplama sonucu
  sonuc: { type: mongoose.Schema.Types.Mixed },
  toplam_bedel: { type: Number },
  aciklama: { type: String },

  // Durum
  durum: {
    type: String,
    enum: ['taslak', 'kesinlesti', 'itiraz', 'iptal'],
    default: 'taslak',
  },

  // Drive raporu
  rapor_drive_file_id: { type: String },
  rapor_drive_link: { type: String },
}, { timestamps: true });

EhgbHesapSchema.index({ isgal_id: 1 });
EhgbHesapSchema.index({ hesaplama_yili: 1 });

const EhgbParametre = mongoose.model('EhgbParametre', EhgbParametreSchema);
const EhgbHesap = mongoose.model('EhgbHesap', EhgbHesapSchema);

module.exports = { EhgbParametre, EhgbHesap };
