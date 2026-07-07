// ============================================================
// server.js'e eklenecek satırlar
// Bu satırları mevcut route tanımlarının yanına ekleyin
// ============================================================

// 1. REQUIRE bölümüne ekle (diğer require'ların yanına):
const tahsisRoutes = require('./modules/tahsis/tahsis.routes');
const cksRoutes    = require('./modules/cks/cks.routes');

// 2. APP.USE bölümüne ekle (diğer app.use'ların yanına):
app.use('/api/tahsis', tahsisRoutes);
app.use('/api/cks',    cksRoutes);

// ============================================================
// Kontrol: Mevcut server.js'de şu satırlar olmalı:
// app.use('/api/ayarlar', ayarlarRoutes);
// app.use('/api/mera',    meraRoutes);
// app.use('/api/isgal',   isgalRoutes);
// app.use('/api/bbhb',    bbhbRoutes);
// app.use('/api/ehgb',    ehgbRoutes);
// app.use('/api/mevzuat', mevzuatRoutes);
// Bunların altına tahsis ve cks satırlarını ekleyin.
// ============================================================
