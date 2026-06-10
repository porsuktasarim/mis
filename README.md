# MİS - Mera İzleme Sistemi

## Teknoloji Stack
- **Backend:** Node.js, Express.js, MongoDB (Mongoose)
- **Frontend:** Bootstrap 5, Vanilla JS, Nginx
- **Altyapı:** Docker, Docker Compose, Coolify

---

## Kurulum

```bash
git clone https://github.com/porsuktasarim/mis.git
cd mis
docker compose up -d
```

### Coolify Ortam Değişkenleri
```
MONGO_USER=misadmin
MONGO_PASS=<şifre>
MONGO_DB=mis_db
JWT_SECRET=<secret>
NODE_ENV=production
```

### Erişim
- Frontend: `https://mis.pors.uk`
- API Health: `https://mis.pors.uk/api/health`

---

## Modüller

### 1. BBHB Hesaplayıcı (`/modules/bbhb/`)
Manuel hayvan adedi girişiyle BBHB hesaplama. Kayıt, geçmiş, PDF/Excel/Word rapor.

**API:** `GET /api/bbhb/turler` · `POST /api/bbhb/hesapla` · `POST /api/bbhb/kaydet`
`GET /api/bbhb` · `GET /api/bbhb/:id` · `DELETE /api/bbhb/:id`
`GET /api/bbhb/:id/rapor/excel` · `/rapor/pdf` · `/rapor/word`

---

### 2. BBHB Dosya Yükleme (`/modules/bbhb-yukle/`)
Türkvet'ten indirilen Büyükbaş/Küçükbaş XLS dosyalarını otomatik işler.

**Özellikler:**
- Birden fazla dosya aynı anda yüklenebilir (max 10, her biri 10MB)
- Sadece CANLI hayvanlar işleme alınır
- Hesaplama tarihi: işlem yapılan ayın 1. günü

**API:** `POST /api/bbhb-yukle/yukle` · `GET /api/bbhb-yukle`
`GET /api/bbhb-yukle/:id` · `DELETE /api/bbhb-yukle/:id`

**Sınıflandırma Kuralları:**

| Tür | Cinsiyet | Yaş | Kategori | BBHB |
|-----|----------|-----|----------|------|
| Sığır | Dişi | 0-21 ay | Dana-düve (ırka göre) | 0.30/0.45/0.60 |
| Sığır | Dişi | 22 ay+ | İnek (ırka göre) | 0.50/0.75/1.00 |
| Sığır | Erkek | 0-12 ay (dahil) | Dana-düve (ırka göre) | 0.30/0.45/0.60 |
| Sığır | Erkek | 13-96 ay | Boğa | 1.50 |
| Sığır | Erkek | 97 ay+ | Öküz | 0.60 |
| Manda | Dişi | - | Manda (dişi) | 0.75 |
| Manda | Erkek | - | Manda (erkek) | 0.90 |
| Koyun | - | 0-12 ay (dahil) | Kuzu-Oğlak | 0.04 |
| Koyun | - | 13 ay+ | Koyun | 0.10 |
| Keçi | - | 0-12 ay (dahil) | Kuzu-Oğlak | 0.04 |
| Keçi | - | 13 ay+ | Keçi | 0.08 |

**Irk sınıflandırması:**
- Irk adı " M" ile bitiyorsa → Kültür melezi
- Aksi halde → Kültür ırkı
- Yerli ırklar (Akkaraman, Kıvırcık vb.) → Yerli

---

## Değişiklik Geçmişi

### v1.2.1
- XLS dönüşümü LibreOffice yerine `xlsx` npm paketi ile yapılıyor (Alpine uyumlu)
- `csv-parse` bağımlılığı kaldırıldı
- Sidebar tüm sayfalarda güncellendi

### v1.2.0
- BBHB Dosya Yükleme modülü eklendi (`/modules/bbhb-yukle/`)
- Türkvet XLS formatı desteği (LibreOffice dönüşümü)
- Çoklu dosya yükleme (max 10)
- Otomatik yaş hesaplama (ayın 1. günü baz alınır)
- Hayvan listesi filtreli detay sayfası

### v1.1.0
- BBHB giriş formu tablo formatına geçirildi
- Sağ sütunda Toplam BBHB vurgu kutusu eklendi

### v1.0.0
- İlk versiyon: BBHB Hesaplayıcı modülü
- Docker + Coolify kurulumu
- PDF, Excel, Word raporlama
