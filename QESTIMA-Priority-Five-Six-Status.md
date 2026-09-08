# QESTIMA v0.12.0 — Priority 5 & 6 Status

هذا الملف يصف ما تم تنفيذه في مصدر QESTIMA الحالي، وما تم تضمينه في معاينة Windows x64 غير الموقّعة.

## الأولوية الخامسة — تعدد المستخدمين والترخيص المركزي

تمت إضافة أساس قابل للتشغيل الجماعي، مع إبقاء Workspace الشخصي المحلي متوافقًا مع Workspace الشركة:

- `server/api.cjs` و`server/central-store.cjs`: API مرجعي مستقل عن الحزم الخارجية، مع SQLite مركزي.
- عزل كامل لكل Tenant في المشاريع، الملفات، المستخدمين، الأجهزة، الأقفال، الدعم وسجل التدقيق.
- تسجيل الدخول المركزي يستخدم scrypt لكلمات المرور وHMAC access tokens قصيرة العمر.
- إصدار اختياري لـ Ed25519 License Token موقّع من الخادم، ويحمل `nbf` و`exp` و`maxUsers` و`maxDevices` و`featureFlags` و`offlineGraceDays`.
- إيقاف/تمديد/إلغاء/تفعيل الترخيص مع سجل تدقيق؛ الترخيص الموقوف أو المنتهي يرفض الكتابة ويترك القراءة وبوابة الإدارة متاحة.
- إدارة المستخدمين والأجهزة والمقاعد، مع `lastConnectionAt` و`appVersion`.
- أقفال مشاريع Soft Locks بمدة انتهاء، وفحص `expectedVersion`، وإرجاع تعارض قابل للمراجعة بدل استبدال بيانات أحدث.
- مزامنة Push/Pull فعلية: تغييرات Company تُوضع في Sync Queue محلية حتى دون اتصال، وWorker يسحب تحديثات الخادم، يدمج غير المتعارض، يوقف المتعارض، ويحتفظ بسجل واضح. تبدأ مزامنة دورية بعد Central Login.
- Owner Portal داخل التطبيق لعرض المقاعد والأجهزة والترخيص والاتصال والتعارضات والتدقيق.
- Temporary Support Access بطلب وموافقة ومدة محددة وإلغاء قابل للتدقيق.
- Object Storage مرجعي بعزل مجلد كل Tenant، مع حد حجم للملفات وSHA-256 للملف.
- Signed Update Manifest مع تحقق Ed25519 من جهة العميل؛ المفتاح الخاص لا يدخل حزمة التطبيق.

## الأولوية السادسة — IFC وRevit

- `app/ifc.js` يقرأ STEP IFC، ويستخرج Schema وCategory وFamily وType وSystem وLevel وZone وSize وMaterial وElement ID وكميات Length/Area/Volume/Count.
- يدعم استيراد Revit JSON محايد صادر من الجسر، بدون تضمين Autodesk DLL داخل التطبيق.
- شاشة `IFC & Model Mapping` تعرض العناصر، ربط BOQ وRate Assembly، اختيار حقل الكمية، حالة الاعتماد، وسجل Revisions.
- كل ربط يبدأ `pending`، ولا تتحول الكمية إلى Takeoff إلا بعد اعتماد المهندس ثم الضغط على Apply.
- مقارنة Revision للنموذج تعرض العناصر المضافة والمحذوفة والمتغيرة وتغيرات الكميات، دون تعديل BOQ تلقائي.
- `revit-addin/QestimaRevitBridge.cs` مصدر C# للقراءة فقط؛ يصدّر Category/Family/Type/System/Level/Room/Zone/Size/Material/quantities وUniqueId وإصدار النموذج.
- لا يزال بناء إضافة Revit الفعلية مرتبطًا بإصدار Revit وSDK وNewtonsoft.Json الموجود لدى العميل.
- أضيف قارئ DXF ASCII مستقل يفهرس Layers وBlocks وPolylines وText وLength/Area/Count والوحدات والأنظمة. DWG يبقى Adapter صريحًا لمحوّل معتمد أو CAD SDK؛ لا يوجد Parser غير مرخص.

## التحقق

تم تشغيل:

```text
node --check على ملفات JavaScript الجديدة والمعدلة
npm test → 49 tests, 49 pass
```

والاختبارات تشمل عزل Tenant، المقاعد، الأقفال، تعارضات المزامنة، توقيع الترخيص، حالة Read-Only، API المركزي، توقيع التحديث، استيراد IFC، ربط واعتماد الكميات، مقارنة Revisions، وجسر Revit المحايد.

## ما تبقى قبل إصدار تجاري أو مُثبّت Windows

المعاينة الحالية تتضمن Installer Windows x64 غير موقّع للاختبار المنضبط. يلزم قبل التوزيع التجاري الخارجي:

1. تشغيل API خلف TLS/Reverse Proxy وIdentity Provider ومخزن أسرار مُدار وRate Limiting وMonitoring.
2. نقل Object Storage إلى خدمة مؤمنة مع فحص ملفات ونسخ احتياطية واستعادة مجرّبة.
3. نشر Public Key موثوق للترخيص والتحديث، وخدمة تحديث موقّعة مع Staged Rollout وRollback.
4. نشر Worker المزامنة خلف API مركزي فعلي وتحسين واجهة حل التعارضات، مع اختبار عدة أجهزة وفروع. عقد Push/Pull والـqueue المحلي موجودان في المصدر.
5. بناء Revit Bridge ضد SDK وإصدار Revit المستهدف وتوقيعه واختباره؛ ثم إضافة IFC geometry/quantity normalization تدريجيًا.
6. ربط نتائج DXF بالـBOQ والقياس المرئي، ثم إضافة DWG عبر SDK مرخّص، وعدم إدخال Autodesk binaries في المستودع.
7. اختبار تثبيت/ترقية/استعادة/انقطاع كهرباء/ملفات كبيرة/انتهاء ترخيص على مصفوفة Windows، ثم Code Signing للمثبّت والبرنامج.
