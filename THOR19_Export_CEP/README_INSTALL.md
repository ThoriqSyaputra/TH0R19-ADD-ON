# THOR19 Export — CEP Extension
## Instalasi dan Penggunaan

---

## Persyaratan
- Adobe Illustrator CC 2019 – 2025 (versi 23–29)
- OS: Windows 10+ atau macOS 10.14+

---

## Cara Install

### Windows
Salin folder `THOR19_Export_CEP` ke:
```
C:\Users\<NamaUser>\AppData\Roaming\Adobe\CEP\extensions\
```

### macOS
Salin folder `THOR19_Export_CEP` ke:
```
/Users/<NamaUser>/Library/Application Support/Adobe/CEP/extensions/
```

---

## Mengaktifkan Debug Mode (Wajib untuk pertama kali)

CEP secara default memblokir ekstensi yang tidak ditandatangani.
Jalankan perintah berikut **sekali saja** untuk mengaktifkan mode debug:

### Windows (Registry)
Buka Command Prompt sebagai Administrator, jalankan:
```
reg add HKCU\Software\Adobe\CSXS.11 /v PlayerDebugMode /t REG_SZ /d 1 /f
```

Untuk Illustrator 2024 (CSXS.11) atau 2025 (CSXS.11 / CSXS.12):
```
reg add HKCU\Software\Adobe\CSXS.10 /v PlayerDebugMode /t REG_SZ /d 1 /f
reg add HKCU\Software\Adobe\CSXS.11 /v PlayerDebugMode /t REG_SZ /d 1 /f
```

### macOS (Terminal)
```bash
defaults write com.adobe.CSXS.11 PlayerDebugMode 1
defaults write com.adobe.CSXS.10 PlayerDebugMode 1
```

---

## Membuka Panel
1. Restart Adobe Illustrator setelah instalasi
2. Di menu Illustrator: **Window → Extensions → THOR19 Export**

---

## Cara Menggunakan
1. Buka file `.ai` di Illustrator
2. Klik **Browse…** untuk memilih folder tujuan output
3. Klik **Export Scene**
4. File `thor19_scene.json` akan tersimpan di folder yang dipilih

---

## Struktur File
```
THOR19_Export_CEP/
├── CSXS/
│   └── manifest.xml          ← Konfigurasi CEP Extension
├── index.html                ← Panel UI
├── css/
│   └── style.css             ← Tema dark panel
├── js/
│   ├── main.js               ← Logika UI & komunikasi
│   └── CSInterface.js        ← Adobe CEP library
├── jsx/
│   └── THOR19_Export.jsx     ← Logika ekspor asli (tidak diubah)
└── host/
    └── bridge.jsx            ← Bridge ExtendScript ↔ Panel
```

---

## Debugging Panel
Saat PlayerDebugMode aktif, buka Chrome DevTools:
```
http://localhost:7777
```
(Port dapat berbeda — cek `manifest.xml` jika perlu ditambahkan `<DebugInfo>`)

---

## Output JSON
Identik 100% dengan output script asli:
```json
{
  "version": "1.0",
  "generator": "THOR19_Export.jsx",
  "source_file": "...",
  "artboard": { ... },
  "layers": [ ... ],
  "paths": [ ... ]
}
```
