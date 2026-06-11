# Codexa Portfolio - Vite + Supabase Admin

Project ini sudah berbasis Vite dan siap dipakai untuk GitHub, Vercel, Supabase, dan custom domain.

## Jalankan lokal

```bash
npm install
npm run dev -- --host --port 5174
```

Buka:

```text
http://localhost:5174/
http://localhost:5174/admin.html
```

Admin tidak diberi tombol di navbar. Akses langsung lewat `/admin.html`.

## Environment lokal

Copy `.env.example` menjadi `.env`, lalu isi:

```env
VITE_SUPABASE_URL=https://project-id.supabase.co
VITE_SUPABASE_ANON_KEY=isi_anon_public_key_kamu
VITE_WHATSAPP_NUMBER=628xxxxxxxxxx
VITE_SUPABASE_LEAD_TABLE=leads
VITE_SUPABASE_PROJECT_TABLE=portfolio_projects
VITE_SUPABASE_CATEGORY_TABLE=project_categories
VITE_SUPABASE_PROJECT_BUCKET=codexa-projects
```

Setiap selesai mengubah `.env`, restart server Vite.

## Setup Supabase

1. Buka Supabase SQL Editor.
2. Jalankan semua isi file `SUPABASE_SETUP.sql`.
3. Buat akun admin di `Authentication > Users > Add user`.
4. Aktifkan auto confirm user saat membuat akun admin jika tersedia.
5. Matikan public signup supaya orang lain tidak bisa daftar sendiri.

Yang dibuat oleh SQL:

- `leads` untuk brief customer.
- `project_categories` untuk kategori custom dari dashboard.
- `portfolio_projects` untuk data project.
- Kolom `media` untuk beberapa foto project.
- Kolom `display_device` untuk pilihan Web Desktop / Web Mobile.
- Storage bucket `codexa-projects`.
- RLS policy agar publik hanya bisa melihat project aktif, sedangkan admin login bisa mengelola data.

## Revisi yang sudah masuk

- Login admin sekarang benar-benar menyembunyikan form login saat berhasil masuk.
- Logout mengembalikan tampilan ke form login.
- Ada menu tambah kategori di dashboard.
- Kategori yang ditambahkan otomatis muncul di form tambah/edit project dan filter halaman utama.
- Project bisa upload beberapa foto sekaligus.
- Ada pilihan tampilan foto utama: Web Desktop atau Web Mobile.
- Foto project di halaman utama auto berpindah halus.
- Saat project diklik, popup punya gallery yang bisa digeser manual.
- Antar section di homepage sudah diberi garis pemisah tipis.
- Tombol WhatsApp di popup sekarang membawa judul project/layanan yang diklik.

## Upload foto profile

Ganti file ini dengan foto kamu:

```text
public/assets/img/foto-devo.jpg
```

Pakai nama file yang sama supaya tidak perlu ubah kode.

## Upload foto project

Cara paling enak sekarang lewat dashboard:

```text
http://localhost:5174/admin.html
```

Login, lalu tambah/edit project dan upload beberapa foto. Pilih `Web Desktop` kalau screenshot lebar, pilih `Web Mobile` kalau screenshot bentuk HP.

## Deploy Vercel

1. Push project ke GitHub.
2. Import repository ke Vercel.
3. Tambahkan Environment Variables yang sama seperti `.env`.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Deploy.

## Catatan penting

`VITE_SUPABASE_ANON_KEY` aman dipakai di frontend selama RLS aktif. Jangan pernah memasukkan `service_role key`, password database, atau secret lain ke frontend.


## Revisi zoom foto project

Di halaman utama, klik card project untuk membuka popup detail. Kalau project punya foto dari dashboard admin, gambar di popup bisa diklik lagi untuk membuka tampilan fullscreen/lightbox. Di lightbox, gambar ditampilkan dengan `object-fit: contain` supaya tidak kepotong dan lebih jelas. Kalau fotonya lebih dari satu, tombol panah kiri/kanan dan keyboard arrow bisa dipakai untuk pindah gambar.


## Troubleshooting kategori

Kalau dashboard menampilkan error `Could not find the table public.portfolio_categories`, berarti environment variable di Vercel/lokal masih memakai nama tabel lama. Pakai nilai berikut:

```env
VITE_SUPABASE_CATEGORY_TABLE=project_categories
```

Versi ini juga sudah diberi fallback agar tetap mencoba `project_categories` walaupun env lama masih terisi `portfolio_categories`.

## Upload banyak foto

Input foto project sekarang bisa dipakai dua cara:

1. Pilih beberapa foto sekaligus dari file picker.
2. Pilih satu foto, lalu klik upload lagi untuk menambah foto berikutnya sebelum menekan Simpan Project.

Semua foto yang terlihat di preview akan disimpan ke kolom `media` di tabel `portfolio_projects`.
