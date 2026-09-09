# تثبيت QESTIMA Tender Operating System v0.9.0

1. أغلق QESTIMA إذا كان مفتوحًا.
2. شغّل `QESTIMA-Universal-Setup-0.8.0.exe`.
3. اختر اللغة ثم اضغط **Install**.
4. اترك **Run QESTIMA Universal** مفعّلًا واضغط **Finish**.
5. استخدم اختصار **QESTIMA** على سطح المكتب بعد ذلك.

يمكن تثبيت v0.8.0 فوق v0.3.1 أو v0.4.0 أو v0.5.0 أو v0.6.0 أو v0.7.x. نفس ملف المستخدم المحلي يُستخدم، ويحوّل البرنامج البيانات إلى Schema v6 عند أول تشغيل بدون تغيير أسعار المشروعات القديمة.

## أول تشغيل وتسجيل الدخول

بعد فتح البرنامج ستظهر شاشة تطلب **USERNAME** و **PASSWORD** قبل الدخول إلى مساحة التسعير.

- اسم المستخدم التجريبي: `admin`
- كلمة المرور التجريبية: `Qestima@2026`
- لا يتم حفظ كلمة المرور كنص واضح؛ يتم حفظ بصمة تحقق محلية للنسخة التجريبية فقط.

تظهر مدة المعاينة على شاشة الدخول، وبعد النجاح تظهر أيضًا أعلى البرنامج في شارة **Preview · عدد الأيام**. اضغط الشارة أو **Activate / Reactivate** لإدخال مفتاح العميل وكود التفعيل.

للتجربة المحلية استخدم:

- License Key: `QESTIMA-DEMO-LOCAL`
- Activation Code: `QESTIMA-DEMO-30` (أو `QESTIMA-TRIAL-90` لتمديد المعاينة)

هذه أكواد معاينة محلية وليست نظام تراخيص مركزيًا نهائيًا. ربط التفعيل الموقّع بخادم الشركة مرحلة لاحقة.

بعد تسجيل الدخول تفتح النسخة الجديدة مباشرةً على مساحة **Drawing/Dimensions Workbench** بنمط Ribbon قريب من برامج الحصر والتسعير الاحترافية. يمكنك فتح Projects وBOQ وUnit Rate Analysis من القائمة الجانبية أو التبويبات العلوية.

## ما الجديد في v0.8.0

- تبويب **Intelligence** في الـRibbon للوصول إلى Smart BOQ Import وHistorical Match وRate Assemblies وQuality Checker وRevision Impact وBid Leveling وWhat-If.
- معاينة استيراد Excel تعرض فروق Added / Deleted / Changed وتحدد RFQs التي تحتاج تحديثًا قبل الحفظ.
- قوالب Rate Assembly جاهزة لـCHW وPPR وFire Fighting وDuctwork وInsulation وValves وPumps وAHU/FCU وSanitary Fixtures، مع تعديل كل مورد ومعامل.
- Quality Checker يلتقط مصدر السعر المفقود، اختلاف الوحدة، الأسعار القديمة، العروض المنتهية، فجوات النطاق، البنود الشاذة والهامش الأدنى.
- Tender Review Gate مرئي قبل التجميد، مع اعتماد مستقل للـScope والعروض والمخاطر والـMarkup وRevision.
- مقارنة الموردين تميز بين Lowest Raw وLowest Compliant وBest Evaluated، وWhat-If يدعم معامل العملة والمورد البديل بدون تعديل النسخة الأساسية.
- اختصارات التنقل: `Ctrl/Cmd+1` BOQ، `2` Rate Analysis، `3` Supplier، `4` Quality، `5` Reports، `6` Drawings، `7` Control Center.

## إصلاح مشكلة التبويبات

إذا كانت النسخة السابقة تبدو كأنها **Read-only**، أغلق كل نوافذ QESTIMA ثم ثبّت v0.8.0. الإصدار الجديد يلتقط الضغط من التبويب نفسه ومن أيقوناته، ويجبر Edge/Chrome على تحميل ملفات الإصدار الجديد بدل نسخة مخزنة مؤقتًا. بعد تسجيل الدخول جرّب **File، Drawings، Dimensions، Workbooks** أو **BOQ Pricing Sheet** للتأكد من انتقال الشاشة.

## ما الجديد في v0.7.4

- شاشة دخول USERNAME / PASSWORD قبل فتح البرنامج.
- مؤشر مدة الترخيص في شاشة الدخول وفي الشريط العلوي.
- نافذة Activate / Reactivate مع أكواد معاينة قابلة للتجربة.
- Logout وسجل دخول داخل Audit Log، مع استمرار حفظ المشاريع والأسعار السابقة.
- فتح مساحة Drawing/Dimensions الاحترافية تلقائيًا بعد الدخول، مع ألوان Ribbon داكنة وأوامر واضحة ومساحة رسم مركزية.

## شكل الواجهة الجديد

- شريط علوي بنظام Ribbon: **File، Home، Drawings، Dimensions، Revisions، Workbooks، Subcontractors**.
- الضغط على أي تبويب يفتح أوامر هذا الجزء تحته مباشرةً.
- قائمة المشروع والملفات على اليسار، ومساحة عمل واسعة تشبه برامج التسعير والحصر الاحترافية.
- شاشة **Drawings & Dimensions** تحتوي على Drawings/Layers/Model/Views وDimension Groups وأوامر Fit/Zoom وقياسات Length/Area/Count اليدوية.
- زر **Select Project / Building** يفتح جدولًا لاختيار المشروع قبل العمل على الرسومات.

التصميم مستوحى من بنية برامج التسعير الاحترافية، مع الحفاظ على هوية QESTIMA وعدم نسخ شعارات أو أصول تجارية.

## ما الجديد في v0.7.2

- إصلاح استجابة التبويبات والقائمة الجانبية حتى عند الضغط على الأيقونة داخل الزر.
- معالجة مشكلة Cache التي كانت قد تُبقي JavaScript قديمًا بعد تحديث البرنامج.

## ما الجديد في v0.7.1

- إعادة تصميم كاملة لواجهة سطح المكتب بنظام Ribbon وتبويبات أوامر قابلة للفتح.
- مساحة عمل الرسومات والـDimension Groups والقياسات اليدوية.
- نافذة اختيار Project / Building بشكل جدول احترافي.
- كل وظائف v0.7 السابقة محفوظة: Tender Control، Smart BOQ، التحليلات، العروض، Quality Gate وFreeze Submission.

## ما الجديد في v0.7.0

- Tender Control Center وTender Readiness Score.
- Smart BOQ Import Templates وتنظيف وتشخيص ملفات Excel.
- مطابقة البنود مع أسعار المشروعات السابقة مع مراجعة المهندس.
- Dynamic Rate Assemblies للمواسير والدكت.
- Revision Impact Analyzer ومقارنة النسخ.
- Commercial Bid Leveling وتنبيهات انتهاء العروض وتقادم الأسعار.
- Pricing Quality Checker مع بوابة اعتماد قبل التسليم.
- What-If وTarget Price Optimizer.
- Assignment وApproval وComments وMentions وFreeze Submission Snapshot.
- Report a Problem مع ملف تشخيص منقّى لا يحتوي على أسعار أو مستندات.

## التوافق

- Windows 10 وWindows 11.
- x86 وx64 وARM64.
- Microsoft Edge أو Google Chrome.

النسخة غير موقعة حاليًا بشهادة نشر تجارية؛ إذا ظهر SmartScreen اختر **More info** ثم **Run anyway** بعد التأكد من اسم الملف ومصدره.
