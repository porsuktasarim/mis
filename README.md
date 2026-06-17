# MİS — Mera İzleme Sistemi

Node.js/Express/MongoDB tabanlı, 4342 sayılı Mera Kanunu kapsamında il/ilçe müdürlükleri için geliştirilmiş mera yönetim sistemi.

---

## Teknoloji Yığını

| Katman | Teknoloji |
|---|---|
| Backend | Node.js 20, Express.js, Mongoose 8 |
| Veritabanı | MongoDB 7 |
| Frontend | Bootstrap 5, Vanilla JS, Leaflet.js |
| Dosya Depolama | Google Drive API (OAuth2) |
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
│   ├── modules/
│   │   ├── mera/          # Mera parsel yönetimi
│   │   ├── isgal/         # İşgal kayıt ve süreç takibi
│   │   ├── bbhb/          # BBHB manuel hesaplama
│   │   ├── bbhb-yukle/    # Türkvet XLS toplu yükleme
│   │   ├── ehgb/          # Eski Haline Getirme Bedeli
│   │   ├── mevzuat/       # Mevzuat takibi
│   │   └── ayarlar/       # Sistem ayarları
└── frontend/public/
    ├── js/sidebar.js
    ├── mera/ isgal/ bbhb/ ehgb/ mevzuat/ ayarlar/
```

---

## Menü Yapısı

```
Modüller  → Mera | İşgal
Araçlar   → BBHB Hesaplayıcı | EHGB Hesaplama | Mevzuat
Defterler → Komisyon Defteri (yakında) | Teknik Ekip Defteri (yakında)
Sistem    → Ayarlar
```

---

## Modüller

### Mera
Mera parsellerinin kayıt, takip ve raporlanması.

- İl/ilçe/mahalle filtreli liste (47.649 mahalle)
- Parsel bilgileri: nitelik, vasıf, toprak sınıfı, tapu/kadastral alan
- Mülkiyet: cilt/sayfa, malik, pay/payda, şerhler
- KML/KMZ yükleme → Google Drive, Leaflet haritada görüntüleme
- Vasıf belgesi (1 yıl) ve tahsis belgesi (5 yıl) sona erme uyarısı
- Otlatma kapasitesi (BBHB), renkli notlar, dosya yönetimi
- PDF raporu

### İşgal
İşgal kayıt ve 11 adımlı süreç takibi.

- Otomatik işgal no: `ISG-YY-NNNN`
- İşgal türü: çoklu seçim (Tarla, Yapılaşma, Yol/Hafriyat)
- 11 adım: Tespit → Komisyon → 3091 (15 gün sayacı) → 2886/75 → Dava → Suç Duyurusu → Eski Hale → Tazminat → Sonuç
- Her adımda belge yükleme (Google Drive), açıklama
- KML/KMZ katman yönetimi: silme, renk değiştirme, katman sırası
- EHGB sekmesi: bağlı hesaplamalar, kesinleşmişse ıslak imza uyarısı
- Sonuç tamamlandığında tüm dosyalar mera parselinin dosyalarına kopyalanır
- Dosya adı formatı: `ISGAL-[no]-[YYYYMMDD]-[adim]-[sira].uzanti`
- Raporlar: HTML/PDF/Word (tekil), Excel (liste)

### BBHB Hesaplayıcı
Büyükbaş Hayvan Birimi hesaplama.

- 17 hayvan türü, işletmeci adı alanı
- **Türkvet XLS yükleme**: il, ilçe, mahalle, işletme sahibi sütunları otomatik parse edilir
- İşletmeci bazlı gruplama: her işletmeci ayrı satırda listelenir
- **Raporlar** (PDF/Excel/Word): ekteki resmi tablo formatında
  - Üstte: `İstanbul İli Silivri İlçesi Akören Mahallesi/Köyü`
  - Tablo: Sıra No | İşletmeci Adı | Kültür Irkı | Kültür Melezi | Yerli Irk | Küçükbaş | Tek Tırnaklı | Toplam BBHB
- **Mera alanı hesabı**: İlin yağış kuşağından iyi vasıf mera verimi (kg/da) kullanılır; ayarlarda tanımlı değilse genel ortalama

### EHGB Hesaplama
Eski Haline Getirme Bedeli hesaplama (4342 sayılı Mera Kanunu).

- Otomatik hesap no: `EHGB-YY-NNNN`
- Alan tipleri: A (tarla), B (hafriyat), C (asfalt/beton), tel örgü, döküm uzaklığı
- Canlı hesaplama (400ms debounce)
- İşgal seçici (opsiyonel bağlantı)
- Hazırlayanlar seçici: 2–6 teknik personel, checkbox ile seçim
- Geçmiş sekmesi: her kayıt snapshot olarak tutulur, silinebilir
- **Rapor (2 sayfa)**:
  - 1. Sayfa: hesaplamalar + personel imzaları (eşit aralıklı, İMZA arka plan)
  - 2. Sayfa: yasal dayanak, formüller, birim fiyat tablosu (2 sütun)
- Yıllık parametreler Ayarlar → EHGB sekmesinden güncellenir

**Hafriyat formülleri:**
```
Yükleme = ((araç_kap×1600 - 1200) / 60 × 11) × sefer
Nakliye  = sefer × km_fiyat × araç_kap × 2 × uzaklık
Depolama = sefer × giriş_ücreti
```

### Mevzuat
Kanun, yönetmelik ve diğer mevzuatların takibi.

- 4 ekleme yöntemi: PDF, metin, link, mevzuat.gov.tr
- Otomatik içerik çekme (bedesten.adalet.gov.tr API)
- Metin içi arama, renkli notlar, değişiklik takibi
- Günlük 04:00 cron

---

## Ayarlar

Şifre korumalı (varsayılan: `123456`).

| Sekme | İçerik |
|---|---|
| Google Drive | OAuth2 bağlantısı |
| Dosya Kategorileri | Bootstrap Icons seçicili kategoriler |
| Toprak Sınıfları | I-VIII |
| Yağış Kuşakları | 81 il → BBHB mera hesabında kullanılır |
| Verim Tabloları | EK-1 yararlanılabilir yeşil ot → BBHB mera hesabında kullanılır |
| Personel – Teknik Ekip | Ad, serbest ünvan, kurum dropdown (+birim), asıl/yedek |
| Personel – Komisyon | Ad, serbest ünvan, komisyon kurumu dropdown |
| Personel – Kullanıcılar | Ad + ünvan seçimli → EHGB raporu imzaları |
| EHGB | Yıllık birim fiyat parametreleri |
| Güvenlik | Şifre değiştirme |

### Personel – Kurum Seçenekleri

**Teknik Ekip:**
İl/İlçe Tarım ve Orman Müdürlüğü, Kadastro, Milli Emlak (Daire/Müdürlük), Orman (İşletme/Bölge), Belediye (+birim → "Kağıthane Belediye Başkanlığı")

**Komisyon:**
Valilik, İl Tarım ve Orman Müdürlüğü, DSİ, Orman, Defterdarlık, Muhakemat, Kadastro, Ziraat Odası, Jandarma, Emniyet, Mahalle Muhtarlığı (+birim)

---

## Google Drive Kurulumu (OAuth2)

1. [console.cloud.google.com](https://console.cloud.google.com) → Yeni proje
2. APIs & Services → Google Drive API → Enable
3. OAuth consent screen → External
4. Credentials → OAuth client ID → Desktop app → JSON indir
5. MİS Ayarlar → Drive → **Hesap Ekle** → JSON yapıştır → Kaydet → **Yetkilendir**

> Service Account yerine OAuth2 kullanılmalıdır (Drive kota sorunu nedeniyle).

---

## Deployment

### `.env` Zorunlu Değişkenler

```env
MONGO_USER=misadmin
MONGO_PASS=güçlü_şifre
MONGO_DB=misdb
JWT_SECRET=uzun_rastgele_dize
AYARLAR_SIFRE=123456
NODE_ENV=production
```

### Docker Compose Servisleri

| Servis | Açıklama |
|---|---|
| `mongo` | MongoDB 7, internal |
| `backend` | Node.js :5000, internal |
| `frontend` | Nginx :80 — static + `/api/` proxy |

```bash
# Deploy
git pull && docker compose up -d --build
```

---

## API Özeti

```
GET|POST        /api/mera
GET|PUT|DELETE  /api/mera/:id
GET             /api/mera/:id/rapor/pdf

GET|POST        /api/isgal
GET|PUT|DELETE  /api/isgal/:id
POST            /api/isgal/:id/adim
PATCH           /api/isgal/:id/kml/:kmlId      (renk güncelle)
DELETE          /api/isgal/:id/kml/:kmlId

GET|POST        /api/ehgb
GET|PUT|DELETE  /api/ehgb/:id
POST            /api/ehgb/hesapla               (canlı hesaplama)
GET             /api/ehgb/:id/rapor             (PDF)
DELETE          /api/ehgb/:id/gecmis/:gecmis_id

GET             /api/bbhb/:id/rapor/excel|pdf|word
POST            /api/bbhb-yukle                 (Türkvet XLS)
```

---

## Versiyon Geçmişi (son)

| Versiyon | Özet |
|---|---|
| v1.8.16 | BBHB: işletmeci bazlı tablo, il/ilçe/mahalle, il bazlı mera hesabı |
| v1.8.15 | BBHB PDF mera alanı verim tablosundan hesap |
| v1.8.14 | BBHB Excel ekteki tablo formatı, açıklama kaldırıldı |
| v1.8.13 | Defterler menüsü, personel ünvan/kurum dropdown, rapor font küçültme |
| v1.8.12 | İşgal çoklu tür seçimi, EHGB geçmiş sekmesi, veri kaybolma fix |
| v1.8.11 | EHGB Word raporu, veri kaybolma fix, işgal bağlantısı |
| v1.8.10 | EHGB aktifEkip scope fix, imza kutusu, tespit/hesaplama tarihi |
| v1.8.8  | Ayarlar personel kaydetme fix (izinli alan güncellemesi) |
| v1.8.6  | EHGB hesap no, personel seçici, tıklanabilir liste |

**Güncel: v1.8.16**
