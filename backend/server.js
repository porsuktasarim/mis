require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const bbhbRoutes = require('./modules/bbhb/bbhb.routes');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'MİS API çalışıyor', version: '1.0.0' });
});

app.use('/api/bbhb', bbhbRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.BACKEND_PORT || 5000;
app.listen(PORT, () => {
  console.log(`MİS Backend ${PORT} portunda çalışıyor [${process.env.NODE_ENV}]`);
});
