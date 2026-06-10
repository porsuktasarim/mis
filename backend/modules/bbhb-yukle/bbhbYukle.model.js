const mongoose = require('mongoose');

const HayvanSatirSchema = new mongoose.Schema({
  kupe_no:        { type: String },
  tur:            { type: String },
  irk:            { type: String },
  cinsiyet:       { type: String },
  dogum_tarihi:   { type: String },
  yas_ay:         { type: Number },
  kategori:       { type: String },
  bbhb:           { type: Number },
  sahip:          { type: String },
  isletme:        { type: String },
  suru_no:        { type: String },
  kaynak_dosya:   { type: String },
});

const BBHBYuklemeSchema = new mongoose.Schema(
  {
    baslik:           { type: String, required: true },
    hesaplama_tarihi: { type: String },
    dosyalar:         [{ type: String }],
    hayvanlar:        [HayvanSatirSchema],
    ozet: {
      toplam_hayvan:  { type: Number, default: 0 },
      toplam_bbhb:    { type: Number, default: 0 },
      kategoriler:    { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    durum: { type: String, enum: ['isleniyor', 'tamamlandi', 'hata'], default: 'isleniyor' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BBHBYukle', BBHBYuklemeSchema);
