const mongoose = require('mongoose');

const IdariSchema = new mongoose.Schema({
  tip: { type: String, enum: ['il', 'ilce', 'mahalle'], required: true },
  ad: { type: String, required: true },
  il_id: { type: String },
  il_ad: { type: String },
  ilce_id: { type: String },
  ilce_ad: { type: String },
  xml_id: { type: String },
}, { timestamps: false });

IdariSchema.index({ tip: 1, il_id: 1 });
IdariSchema.index({ tip: 1, ilce_id: 1 });

module.exports = mongoose.model('Idari', IdariSchema);
