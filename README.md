# MİS — Mera İzleme Sistemi

Node.js/Express/MongoDB tabanlı, 4342 sayılı Mera Kanunu kapsamında il/ilçe müdürlükleri için geliştirilmiş mera yönetim sistemi.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Backend | Node.js 20, Express.js, Mongoose 8 |
| Veritabanı | MongoDB 7 |
| Frontend | Bootstrap 5, Vanilla JS, Leaflet.js |
| Dosya Depolama | Google Drive API (OAuth2) / Sunucu lokal fallback |
| Altyapı | Docker Compose, Coolify |
| Raporlama | ExcelJS, docx |
| Zamanlama | node-cron |

---

## Proje Yapısı

```
mis-app/
├── docker-compose.yml
├── .env
├── backend/
│   ├── server.js
│   └── modules/
│       ├── mera/          # Mera parsel yönetimi
│       ├── isgal/         # İşgal kayıt ve süreç takibi
│       ├── bbhb/          # BBHB hesaplama (16 hayvan türü)
│       ├── bbhb-yukle/    # Türkvet XLS toplu yükleme
│       ├── ehgb/          # Eski Haline Getirme Bedeli
│       ├── mevzuat/       # Mevzuat takibi
│       ├── tahsis/        # Tespit/Tahdit/Tahsis (3T) modülü
│       ├── cks/           # ÇKS yükleme aracı
│       └── ayarlar/       # Sistem ayarları
└── frontend/public/
    ├── js/sidebar.js
    ├── js/lang.js           # Merkezi dil yöneticisi
    ├── js/lang.tr.json      # Türkçe dil dosyası
    ├── mera/ isgal/ bbhb/ ehgb/ mevzuat/ ayarlar/
    ├── tahsis/              # 3T liste + detay
    └── cks/                 # ÇKS yükleme aracı
```

---

## Menü Yapısı

```
Modüller  → Mera | İşgal | Tespit/Tahdit/Tahsis (3T) | TAD (yakında) | Proje (yakında)
Araçlar   → BBHB Hesaplama | EHGB Hesaplama | Mevzuat | ÇKS Yükleme | 5/b | Bilgi Notu | Teknik Şartname
Defterler → Komisyon Defteri (yakında) | Teknik Ekip Defteri (yakında)
Sistem    → Ayarlar
```

---

## Modüller

### Mera
Mera parsellerinin kayıt, takip ve raporlanması.

- İl/ilçe/mahalle filtreli liste (47.649 mahalle), ayarlardaki öncelikli iller üstte
- Parsel bilgileri: nitelik, vasıf, toprak sınıfı, kaynak (4342/5. madde: 5/a-d)
- **Tapu Alanı ve Tespit Alanı**: m² cinsinden giriş → da'ya otomatik dönüşüm (21520,43 m² → 21 da 520,43 m²)
- Mülkiyet: cilt/sayfa, malik, pay/payda, şerhler
- KML/KMZ/**GeoJSON** yükleme → Google Drive (Drive yoksa sunucu lokaline fallback), Leaflet haritada görüntüleme
- Vasıf "Bilinmiyor" seçilirse otlatma hesabı "Orta" vasıf olarak yapılır
- Vasıf belgesi (1 yıl) ve tahsis belgesi (5 yıl) sona erme uyarısı
- Otlatma kapasitesi (BBHB), renkli notlar, dosya yönetimi
- **İşgaller sekmesi**: parseldeki işgaller listelenir, tıklanınca işgal detayına gider
- PDF raporu

### İşgal
İşgal kayıt ve 11 adımlı süreç takibi.

- Otomatik işgal no: `ISG-YY-NNNN`
- İşgal türü: çoklu seçim (Tarla/Yapılaşma, Yol/Hafriyat)
- 11 adım: Tespit → Komisyon → 3091 → 2886/75 → Dava → Suç Duyurusu → Eski Hale → Tazminat → Sonuç
- KML/KMZ/**GeoJSON** katman yönetimi
- EHGB sekmesi bağlantısı
- Raporlar: HTML/PDF/Word (tekil), Excel (liste)

### BBHB Hesaplama
Büyükbaş Hayvan Birimi hesaplama — **16 hayvan türü**.

| Grup | Türler |
|---|---|
| Kültür Irkı | İnek, Dana-Düve |
| Kültür Melezi | İnek, Dana-Düve |
| Yerli Irk | İnek, Dana-Düve |
| Büyükbaş Diğer | Boğa, Öküz |
| Manda | Erkek, Dişi |
| Küçükbaş | Koyun, Keçi, Kuzu/Oğlak |
| Tek Tırnaklı | At, Katır, Eşek |

- Türkvet XLS toplu yükleme, işletmeci bazlı gruplama
- **Raporlar (Excel/PDF/Word)**:
  - Yer başlığı: `İstanbul İli Silivri İlçesi Akören Köyü/Mahallesi`
  - BBHB katsayı satırı (sarı arka plan)
  - **4 vasıf mera hesabı**: 🟢 Çok İyi / 🔵 İyi / 🟡 Orta / 🔴 Zayıf — il yağış kuşağından veya genel ortalamadan
  - Özet: Toplam Hayvan, BBHB, İşletmeci Sayısı, Canlı Ağırlık, Yeşil/Kuru Kaba Yem

### EHGB Hesaplama
Eski Haline Getirme Bedeli (4342/Mera Kanunu).

- Otomatik hesap no: `EHGB-YY-NNNN`
- Alan tipleri: A (tarla), B (hafriyat), C (asfalt/beton), tel örgü, döküm uzaklığı
- Canlı hesaplama, geçmiş sekmesi, EHGB bağlantısı
- Hazırlayanlar seçici: 2–6 teknik personel, imza sayfası

### Tespit/Tahdit/Tahsis (3T)
4342 sayılı Mera Kanunu kapsamında tespit, tahdit ve tahsis süreç yönetimi.

- Otomatik 3T no: `TAH-YY-NNNN`
- **2 adımlı başlatma**: Temel bilgiler → Parsel seçim ekranı (köy meraları listelenir, checkbox seçim)
- **Sekmeler**: Genel | Parseller | Bağlantılar | Raporlar
- **Parseller**: Mahalle bazlı mera parselleri, dahil/hariç seçimi, KML uyarısı
- **Bağlantılar**: BBHB hesabı bağlama (mahalle eşleşmesi öne çıkar) + ÇKS kaydı seçme
- **Ek-4/ab raporu** (Excel): BBHB + ÇKS birleştirme
  - 16 hayvan sütunu, Toplam Hayvan Varlığı + BBHB
  - Teknik ekip imza satırı (ilçe bazlı, 4+5 düzeni)
- **Ek-4/c**: Parsel gruplandırma → harita çıktısı (yakında)
- **Süreç adımları**: Sağ panelde canlı durum takibi
- **İl önceliği**: Ayarlardaki öncelikli iller yeni 3T ekranında üstte görünür
- Ek-4/d, e, f, g, h, 5, 6, 7, 8, 9, 10 yakında

### ÇKS Yükleme (Araç)
Çiftçi Kayıt Sistemi köy genelinde parsel üretim belgesi yükleme.

- T.C. Tarım ve Orman Bakanlığı ÇKS formatı (.xlsx)
- Ürün gruplandırma: **Yem Bitkisi** / **Sebze-Bağ** / **Hububat**
- 3T modülündeki Ek-4/ab raporunda kullanılır

### Mevzuat
- 4 ekleme yöntemi: PDF, metin, link, mevzuat.gov.tr
- Günlük 04:00 cron otomatik güncelleme

---

## Dil Sistemi

`/js/lang.tr.json` — Tüm Türkçe arayüz metinleri tek dosyada.

```js
L('mera.yeni_mera')           // → "Yeni Mera"
L('isgal.turler.yapilasma')   // → "Yapılaşma"
L('sayfalama.sayfa_bilgi', { toplam:100, baslangic:1, bitis:20 })
// → "100 kayıttan 1-20 arası"
```

HTML attribute ile: `<span data-l="genel.kaydet"></span>`

---

## Ayarlar

Şifre korumalı (varsayılan: `123456`).

| Sekme | İçerik |
|---|---|
| **Depolama Alanı** | OAuth2 Drive bağlantısı, token durumu (gecerli/suresi_dolmus/yenilenebilir), dosya taşıma |
| Dosya Kategorileri | Bootstrap Icons seçicili kategoriler |
| Toprak Sınıfları | I-VIII |
| Yağış Kuşakları | 81 il → BBHB mera hesabında kullanılır |
| Verim Tabloları | EK-1 yararlanılabilir yeşil ot |
| Personel – Teknik Ekip | Ad, ünvan, kurum dropdown, asıl/yedek |
| Personel – Komisyon | Ad, ünvan, komisyon kurumu |
| Personel – Kullanıcılar | Ad + ünvan → EHGB raporu imzaları |
| EHGB | Yıllık birim fiyat parametreleri |
| Güvenlik | Şifre değiştirme |

### Depolama Alanı
- Google Drive OAuth2 bağlantısı — token durumu gösterilir
- Drive bağlantısı başarısız olursa KML/dosyalar sunucu lokaline kaydedilir (fallback)
- "Tümünü Sunucuya Taşı" / "Tümünü Drive'a Taşı" — şifre onaylı

### Kurum Seçenekleri (Teknik Ekip)
İl/İlçe Tarım ve Orman Müdürlüğü, Kadastro, Milli Emlak, Orman, Belediye, Mahalli Bilirkişi, Muhtarlık

---

## Google Drive (OAuth2)

1. [console.cloud.google.com](https://console.cloud.google.com) → Yeni proje
2. APIs & Services → Google Drive API → Enable
3. OAuth consent screen → External
4. Credentials → OAuth client ID → Desktop app → JSON indir
5. Ayarlar → Depolama Alanı → Hesap Ekle → JSON yapıştır → **Yetkilendir** (yeni sekmede açılır, kod kopyalanır)

> Service Account yerine OAuth2 kullanılmalıdır. Token süresi dolunca "Yeniden Yetkilendir" butonu çıkar.

---

## Deployment

```env
MONGO_USER=misadmin
MONGO_PASS=güçlü_şifre
MONGO_DB=misdb
JWT_SECRET=uzun_rastgele_dize
AYARLAR_SIFRE=123456
NODE_ENV=production
```

```bash
git pull && docker compose up -d --build
```

### server.js Route Kaydı (zorunlu)
```js
const tahsisRoutes = require('./modules/tahsis/tahsis.routes');
const cksRoutes    = require('./modules/cks/cks.routes');
app.use('/api/tahsis', tahsisRoutes);
app.use('/api/cks',    cksRoutes);
```

---

## API Özeti

```
GET|POST        /api/mera
GET|PUT|DELETE  /api/mera/:id
GET             /api/mera/:id/rapor/pdf
POST            /api/mera/:id/kml

GET|POST        /api/isgal
GET|PUT|DELETE  /api/isgal/:id
POST            /api/isgal/:id/adim

GET|POST        /api/ehgb
GET|PUT|DELETE  /api/ehgb/:id
GET             /api/ehgb/:id/rapor

GET             /api/bbhb/:id/rapor/excel|pdf|word
POST            /api/bbhb-yukle

GET|POST        /api/tahsis
GET|PUT|DELETE  /api/tahsis/:id
POST            /api/tahsis/:id/parseller/yukle
PUT             /api/tahsis/:id/parseller/:parsel_id
POST            /api/tahsis/:id/bbhb
DELETE          /api/tahsis/:id/bbhb/:id
POST            /api/tahsis/:id/rapor/ek4ab
PUT             /api/tahsis/:id/parsel-gruplari
PUT             /api/tahsis/:id/teknik

GET|POST        /api/cks
POST            /api/cks/yukle
GET             /api/cks/:id
POST            /api/cks/:id/kisiler
DELETE          /api/cks/:id

GET             /api/ayarlar
PUT             /api/ayarlar
POST            /api/ayarlar/drive
GET             /api/ayarlar/drive/:id/boyut
POST            /api/ayarlar/drive/:id/token-kontrol
POST            /api/ayarlar/dosya-tasi/sunucu|drive
```

---

## Versiyon Geçmişi

| Versiyon | Özet |
|---|---|
| v1.8.37+ | Tespit/Tahdit/Tahsis (3T) modülü: 2 adımlı başlatma, parsel seçim, BBHB/ÇKS bağlantı, Ek-4/ab Excel (16 sütun, teknik ekip imza) |
| v1.8.30+ | ÇKS yükleme aracı, GeoJSON desteği, Drive fallback, token yenileme |
| v1.8.25+ | BBHB 16 hayvan türü, 4 vasıf mera hesabı, yer başlığı formatı |
| v1.8.20  | Merkezi dil dosyası (lang.tr.json), sidebar yeniden yapılandırma |
| v1.8.18  | Mera işgal sekmesi, KML Google Earth fix, Ayarlar Depolama Alanı |
| v1.8.16  | BBHB işletmeci bazlı tablo, il bazlı mera hesabı |
| v1.8.12  | İşgal çoklu tür, EHGB geçmiş sekmesi |
| v1.8.8   | Personel ünvan/kurum dropdown, kaydetme fix |

**Güncel: v1.8.54**
