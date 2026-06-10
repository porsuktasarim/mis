const mongoose = require('mongoose');

const HayvanKalemiSchema = new mongoose.Schema({
  tur_id:   { type: String, required: true },
  tur_adi:  { type: String, required: true },
  katsayi:  { type: Number, required: true },
  adet:     { type: Number, required: true, min: 0 },
  bbhb:     { type: Number, required: true },
});

const BBHBHesaplamaSchema = new mongoose.Schema(
  {
    baslik:        { type: String, required: true, trim: true },
    aciklama:      { type: String, default: '' },
    hayvanlar:     { type: [HayvanKalemiSchema], default: [] },
    toplam_adet:   { type: Number, default: 0 },
    toplam_bbhb:   { type: Number, default: 0 },
    tur_sayisi:    { type: Number, default: 0 },
    durum:         { type: String, enum: ['taslak', 'tamamlandi'], default: 'taslak' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BBHBHesaplama', BBHBHesaplamaSchema);
