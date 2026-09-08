# QESTIMA 0.12.0 — Windows x64 Preview

## الملفات

- `QESTIMA-Setup-0.12.0-win32-x64-Preview-Unsigned.exe`
- `QESTIMA-Setup-0.12.0-win32-x64-Preview-Unsigned.exe.sha256`
- `QESTIMA-Setup-0.12.0-win32-x64-Preview-Unsigned.exe.release.json`
- `QESTIMA-Source-0.12.0-Preview-Current.zip`
- `QESTIMA-Source-0.12.0-Preview-Current.zip.sha256`
- `QESTIMA-app-v0.12.0.js` (نسخة مستقلة من واجهة التطبيق عند الحاجة للمراجعة)
- `QESTIMA-app-v0.12.0.js.sha256`

حزمة المصدر الحالية تتضمن التطبيق، Electron main/preload، التخزين SQLite/Project Package، الخادم المركزي المرجعي، محولات PDF/DXF/IFC، اختبارات التغليف، وسكربتات البناء والتوقيع. لا تتضمن Runtime Electron أو مجلد `release` المولد.

## التثبيت

1. نزّل ملف الـEXE على Windows 10 أو Windows 11 بنظام 64-bit.
2. افحص البصمة من ملف `.sha256` إن كانت أداة SHA-256 متاحة.
3. شغّل الملف واختر Install.
4. افتح QESTIMA من الاختصار، ثم أنشئ حساب المدير الأول عند ظهور شاشة الدخول.
5. ابدأ من Cost Estimation أو استورد Tender Package/BOQ.

## ملاحظات مهمة

- هذه معاينة غير موقّعة لأن شهادة Code Signing التجارية غير متاحة أثناء البناء. قد يعرض Windows SmartScreen تحذيرًا؛ لا تتجاوز التحذير إلا إذا تحققت من مصدر الملف والبصمة.
- الموجّه مخصص لأجهزة Windows x64. لا تستخدمه على Windows 32-bit أو ARM64؛ سيتم إصدار Runtime منفصل لهما بعد تجهيز واختبار البنية المناسبة.
- البيانات تُخزّن محليًا في SQLite/Project Package مشفّر. لا يقوم المثبّت بحذف بيانات المستخدم القديمة تلقائيًا.
- خذ Backup قبل تجربة الترقية أو استيراد مشاريع قديمة.
- قراءة PDF/OCR تعتمد على الأدوات الخارجية المتوفرة، ودعم DWG الأصلي يحتاج Converter/CAD SDK مرخّص. دعم DXF وIFC موجود ضمن المعاينة.

## نتائج الاختبار

- `npm test` — 51 اختبارًا ناجحًا.
- `npm run test:packaging` — 12 اختبارًا ناجحًا.
- Runtime Manifest — سليم ومطابق لـElectron 37.2.6 / Windows x64.
- NSIS — تم تجميع الـInstaller بنجاح.
- SHA-256 sidecar — تم التحقق منه بنجاح.
- لم يتم تشغيل واجهة Windows فعليًا داخل بيئة Linux؛ يلزم اختبار تثبيت وتشغيل على Windows قبل التوزيع الخارجي.
