// server.js'e eklenecek satırlar:
//
// require satırına ekle:
// const tahsisRoutes = require('./modules/tahsis/tahsis.routes');
//
// app.use satırına ekle:
// app.use('/api/tahsis', tahsisRoutes);
//
// Bu dosyayı server.js'e manuel olarak entegre edin.
// Tam satır örneği:

/*
  // Mevcut route'ların altına ekle:
  const tahsisRoutes = require('./modules/tahsis/tahsis.routes');
  app.use('/api/tahsis', tahsisRoutes);
*/
