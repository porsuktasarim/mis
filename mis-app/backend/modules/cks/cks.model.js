const mongoose = require('mongoose');

// Tek kişinin ÇKS satırı
const CksKisiSchema = new mongoose.Schema({
  sira_no:    { type: Number },
  ad_soyad:   { type: String, required: true, index: true },
  tc_vkn:     { type: String },
  il:         { type: String },
  ilce:       { type: String },
  koy:        { type: String },
  // Ekiliş alanları (da)
  yem_bitkisi:{ type: Number, default: 0 },  // Yulaf, İtalyan Çimi, Arpa(Yemlik), Çayır Otu
  sebze_bag:  { type: Number, default: 0 },  // Sebze, meyve, üzüm
  hububat:    { type: Number, default: 0 },  // Arpa, Buğday, Ayçiçeği
  toplam_alan:{ type: Number, default: 0 },
  // Ham ürün detayı (kaynak için saklıyoruz)
  urunler: [{
    urun_adi: String,
    alan_da:  Number,
    tarim_sekli: String,
    grup: String,  // 'yem_bitkisi' | 'sebze_bag' | 'hububat' | 'diger'
  }],
});

const CksYukleSchema = new mongoose.Schema({
  dosya_adi:    { type: String },
  uretim_yili:  { type: Number },
  il:           { type: String },
  ilce:         { type: String },
  koy:          { type: String },
  kisi_sayisi:  { type: Number, default: 0 },
  kisiler:      [CksKisiSchema],
  aciklama:     { type: String },
}, { timestamps: true });

CksYukleSchema.index({ il: 1, ilce: 1, koy: 1 });
CksYukleSchema.index({ uretim_yili: 1 });

module.exports = mongoose.model('CksYukle', CksYukleSchema);
