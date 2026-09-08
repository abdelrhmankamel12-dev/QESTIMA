# QESTIMA — سجل التحديث الحالي

هذه حزمة مصدرية محدثة ومعها معاينة Windows x64 للتجربة المضبوطة. المعاينة غير موقعة وليست إصدارًا تجاريًا موثوقًا.

## ما تم تنفيذه في المصدر

### الواجهة وتجربة العمل

- تطبيق واجهة Windows احترافية مستوحاة من النموذج المرفق: شريط علوي داكن، لون ذهبي للحالة النشطة، Ribbon متعدد المستويات، وتابات Workbooks.
- ترتيب التابات الرئيسية: `File | Home | Drawings | Dimensions | Revisions | Cost Estimation | Suppliers | Intelligence | Reports | Administration`.
- جعل `Cost Estimation` مساحة العمل الأولى بعد تسجيل الدخول، وبداخلها BOQ وRate Build-Up وResources وProductivity وPricing وReview وOutputs.
- جدول BOQ مركزي، وRate Inspector جانبي، وCost Summary، وشريط حالة سفلي.
- أوامر Contextual تظهر حسب العنصر المحدد، مع Disabled state ورسالة توضح سبب عدم الإتاحة.
- دعم RTL/LTR والوضعين الفاتح والداكن.

### التسعير والذكاء

- استيراد وتنظيف BOQ وتشخيص الوحدات والتكرار والكميات.
- Historical Item Matching دون اعتماد تلقائي للسعر.
- Rate Assemblies للأنظمة الميكانيكية، وفصل التكلفة عن سعر البيع.
- Quality Checker وRevision Impact وWhat-If وTarget Price.
- Supplier Bid Leveling وQuote Expiry وPrice Aging.
- Tender Review Gate وFreeze Tender Snapshot وAudit Trail.

### المستندات والقياسات

- سجل مستندات وإصدارات Addendum مع تعليم النسخ القديمة `Superseded`.
- استخراج PDF النصي مع مسار OCR خارجي عند توفر Poppler/Tesseract.
- قياسات PDF اليدوية مع المصدر والصفحة واعتماد المهندس.
- فهرسة DXF وطبقاتها وكياناتها، وعرضها بصريًا داخل مساحة الرسم.
- دعم IFC مع Model Mapping ومقارنة الإصدارات بعد اعتماد المستخدم.

### التخزين والعمل الجماعي

- SQLite محلي مشفّر مع جداول وفهارس طبيعية بدل LocalStorage.
- Project Package مشفّر يحوي قاعدة البيانات والمرفقات والإصدارات، مع Checksums والتحقق من السلامة.
- توقيع اختياري لحزمة المشروع وتوقيع Manifest مرتبط ببصمة Checksums.
- Local/Company Workspace، صلاحيات، سجل تغييرات، ومزامنة مركزية أساسية مع كشف التعارضات.
- Auto-save وCrash Recovery وBackup/Restore.

### الاختبارات

- اختبارات المصدر: `51/51` ناجحة.
- اختبارات التغليف والاستعادة: `12/12` ناجحة.
- فحص Syntax للواجهة ومحرك CAD ناجح.

## حالة الإصدار الحالية

- تم إنشاء معاينة Windows x64 مضمّنة: `QESTIMA-Setup-0.12.0-win32-x64-Preview-Unsigned.exe`.
- تم إنشاء ملف SHA-256 وملف Release Manifest مطابقين للـInstaller.
- تم إنشاء حزمة مصدر محدثة للاختبار.
- تم استخدام مُنشئ إصدار قابل للتكرار مع Runtime Electron Windows x64 مضمّن.
- هذه معاينة `Preview-Unsigned` وليست نسخة تجارية موقّعة.
- لم يتم توقيع الملفات بشهادة تجارية؛ التوقيع جاهز في سكربتات البناء ويحتاج شهادة وبيئة Windows.
- لم يتم تضمين Poppler/Tesseract داخل الحزمة.
- دعم DWG الأصلي يحتاج Converter أو CAD SDK مرخّص؛ دعم DXF متاح حاليًا.
- المزامنة المركزية تحتاج نشر TLS وIdP وSecrets وObject Storage فعليًا.
- اختبارات أجهزة Windows الفعلية والتحديث/الرجوع للإصدار السابق ما زالت مطلوبة.

## ملاحظة البيانات

لم يتم حذف البيانات الموجودة تلقائيًا. الحذف الجماعي يجب أن يتم عبر Factory Reset صريح بعد Backup أو عبر Migration معتمد، حتى لا تضيع بيانات المستخدم بدون استرجاع.
