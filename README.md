# Idle Forest — Android

Sadece oyun kısmı. Next.js (static export) + Capacitor ile Android uygulaması.

- Navbar, footer, duyuru bandı, skor tablosu, telemetri/analitik ve Supabase kaldırıldı.
- Tüm oyun verisi cihazda **şifresiz SQLite** dosyasına yazılır
  (`/data/data/com.idleforest.game/databases/idleforestSQLite.db`).
- Kayıt aralığı: **10 saniye** (`app/hooks/useGameLogic.ts` -> `SAVE_INTERVAL_MS`, 5–30 sn arası ayarlanabilir).
  Uygulama arka plana alınınca da bir kez anında kaydeder.

## APK derleme
GitHub → Actions → **Android APK Build** → *Run workflow*. Bitince artifact olarak `app-debug.apk` iner.

## Yerelde geliştirme
```
npm install
npm run dev          # tarayıcıda çalışır (DB yerine localStorage kullanır)
npm run android:build
```
