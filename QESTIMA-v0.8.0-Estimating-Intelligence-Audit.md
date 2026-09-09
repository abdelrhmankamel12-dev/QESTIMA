# QESTIMA v0.8.0 — Estimating Intelligence Audit

## نطاق التحديث

هذه النسخة تطوّر QESTIMA من مساحة تخزين وتسعير إلى طبقة مساعدة تقلل إعادة العمل داخل دورة المناقصة، مع إبقاء قرار اعتماد السعر والكمية بيد المهندس.

| المجال | ما تم تنفيذه | ملاحظة الاعتماد |
| --- | --- | --- |
| Smart BOQ Import | تنظيف وتشخيص الصفوف والوحدات والأرقام والتكرارات، حفظ نماذج العميل، Preview، ومقارنة الملف الحالي بالـBOQ قبل الحفظ | لا يتم تعديل الـBOQ قبل Confirm |
| Historical Matching | بحث تشابه مع مشاريع مساحة العمل، نسبة تطابق، تاريخ ومصدر وسياق السعر والفروق | النسخ يحتاج Review & Copy صريح |
| Dynamic Rate Assemblies | CHW، PPR، Fire Fighting، Ductwork، Insulation، Valves، Pumps، AHU/FCU، Sanitary Fixtures | الموارد والمعاملات قابلة للتغيير لكل مشروع |
| Pricing Quality Checker | مصدر السعر، اختلاف الوحدة، البنود غير المسعرة، الأسعار القديمة، العروض المنتهية، RFQ follow-up، Scope Gap، historical outlier، minimum margin | النتائج استشارية ويمكن تسجيل Waiver رسمي |
| Tender Review Gate | Intake Review، Scope، BOQ pricing، quote validity، risks، markup approval، saved revision | Freeze Submission يرفض الحالة غير المكتملة إلا بخيار waiver صريح |
| Revision Impact | Added / Deleted / Changed، فرق التكلفة، وRFQs المتأثرة | المقارنة لا تستبدل أسعار النسخة العاملة |
| Supplier Leveling | Lowest Raw، Lowest Compliant، Best Evaluated بعد الخصم والشحن والمخاطر وVAT والصلاحية | الاختيار يظل لكل بند |
| What-If | تغير مواد/عمالة/معدات/مقاول، contingency، خصم مورد، ربح، معامل عملة، مورد بديل | يعمل على نسخة عميقة ولا يغيّر الأساس |
| UI | تبويب Intelligence في الـRibbon، BOQ work area، Inspector، Gate checklist، اختصارات Ctrl/Cmd+1…7 | عناصر القراءة الذكية الكاملة للـPDF والقياس المرئي PDF/DWG ما زالت مؤجلة |

## سلامة البيانات

- ما زالت بنية Schema v6 متعددة المستخدمين جاهزة: Workspaces، صلاحيات، Snapshots، Audit Log، Revisions، Attachments وLocal cache.
- تحديث مكتبة الأسعار لا يغيّر Snapshot داخل مشروع قائم تلقائيًا.
- النسخة الأصلية للمناقصة والـRevision لا يتم الكتابة فوقها.
- What-If وHistorical Matching لا يعتمدان سعرًا أو كمية بدون إجراء المستخدم.

## التحقق

- `node --check app/core.js`
- `node --check app/app.js`
- `node --test tests/*.test.cjs` — جميع الاختبارات تمر.
- بناء NSIS للويندوز 10/11 (x86/x64/ARM64 عبر Universal launcher) مكتمل.

## المؤجل عمدًا

القراءة الذكية الكاملة لمحتوى PDF، وأدوات القياس المرئي داخل PDF/DWG، والمزامنة المركزية الحية، وتحديثات الخادم الموقعة ليست جزءًا من هذه النسخة.
