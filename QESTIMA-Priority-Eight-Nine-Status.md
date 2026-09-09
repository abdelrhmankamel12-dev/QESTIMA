# QESTIMA — Cost Estimation Ribbon and Workbench Status

تم تحديث مصدر QESTIMA v0.12.0 بإضافة تاب مستقل باسم **Cost Estimation** بعد Revisions وقبل Suppliers، مع الحفاظ على سير عمل التسعير وبيانات Schema v6.

## 1. Ribbon command groups

كل تاب رئيسي يغيّر شريط الأوامر الخاص به فقط:

| Main tab | Groups now exposed |
| --- | --- |
| File | Project File, Exchange |
| Home | Project, BOQ & Pricing, Review |
| Drawings | Import, Drawing, View, Layers, Scale, Revisions, Model Review |
| Dimensions | Measuring, Dimension Groups |
| Revisions | Version Control |
| Cost Estimation | BOQ, Rate Build-Up, Resources, Productivity, Indirect Cost, Pricing, Selling Price, Scenarios, Review, History, Outputs |
| Suppliers | Procurement, Commercial |
| Intelligence | Estimating Intelligence, Control & Scenarios |
| Reports | Report Center, Review Outputs |
| Administration | Administration, Company |

الأوامر التي لها تنفيذ فعلي تفتح مساحة العمل المرتبطة بها. DXF/DWG، Pan/Rotate وطبقات PDF تظهر كأوامر Disabled مع سبب واضح؛ لا يتم الإيحاء بأن محرك CAD أو Layers متاح قبل دمجه فعليًا.

## 2. مساحة العمل

- القائمة الجانبية تبقى شجرة المشروع والتنقل الرئيسية.
- الوسط يعرض BOQ، الرسم، التحليل، الموردين أو التقرير بحسب التاب المفتوح.
- BOQ يحافظ على Rate Inspector يمين الجدول، وتحليل السعر يحافظ على Cost Ladder يمين ورقة التحليل.
- الرسم يحافظ على Drawing/Dimension dock يسار مساحة الرسم وStage مركزيًا.
- الشريط السفلي يعرض كود المشروع، تقدم التسعير، حالة Tender Review، العملة وعدد البنود غير المسعرة.
- `workspace-tabs` أصبحت `tablist` حقيقية بحالة `aria-selected` وتنقل لوحة المفاتيح، وتبقى الشاشات المفتوحة دون فقد مكان العمل.

## 3. التابات السياقية

تظهر حسب السياق فقط:

- **Drawing Tools** عند فتح الرسومات أو Model Mapping.
- **Dimension Tools** أثناء القياس أو عند اختيار أدوات القياس.
- **BOQ Item Tools** عند تحديد بند داخل BOQ أو Rate Analysis.
- **Quotation Tools** عند فتح RFQs وعروض الموردين.

كل زر سياقي يستخدم نفس handlers والصلاحيات الموجودة، ولا يعتمد سعرًا أو كمية أو عرضًا تلقائيًا.
خريطة صلاحيات مركزية تعطل أوامر التحرير عند عدم امتلاك `project.edit` أو `pricing.edit` أو `takeoff.edit` أو `rfq.edit` أو الصلاحيات المناسبة، كما يدخل الـRibbon وضع القراءة عند انتهاء الترخيص مع إبقاء مسار إعادة التفعيل متاحًا.

## 4. السلوك والحفظ

- الضغط على تاب رئيسي يغيّر الأوامر فقط.
- الضغط على أمر يفتح مساحة العمل المقصودة، ويحدد Ribbon المناسب لها.
- فتح نفس المشروع في أكثر من Workspace tab لا يلغي الشاشات المفتوحة.
- يتم حفظ `activeView` و`activeRibbonTab` و`activeContextTab` و`openTabs` و`activeItemId` و`activeDrawingId` وحالة طي الـRibbon داخل `uiState`.
- إغلاق الرسم يحافظ على المشروع والمستندات ويتيح إعادة فتحه من Drawings.
- النقر المزدوج على تاب رئيسي يطوي أو يعيد إظهار الـRibbon؛ الحالة تستمر بعد إعادة التشغيل.

## 5. الاختبار

تم تشغيل فحص JavaScript و`npm test` بعد التعديل:

- 39 اختبارًا ناجحًا.
- تحقق إضافي من ترتيب التابات العشرة، مجموعات Drawings/Cost Estimation، عناصر التابات السياقية، حفظ UI state، طي الـRibbon، ودعم Workspace tablist.

## 6. Configuration-driven Ribbon — v0.12.0

- تمت إضافة `ribbonConfig` كمصدر واحد لتعريف التابات والمجموعات والأوامر؛ لا يعتمد تشغيل الـRibbon على كتابة أزرار كل تاب داخل HTML.
- كل أمر يحتفظ بـ`id` واسم عربي/إنجليزي وأيقونة واختصار وصلاحية وFeature Flag وحالة Enabled وسبب التعطيل وبيانات إضافية.
- `renderRibbonCommand` و`commandAvailability` يبنيان الأوامر ويطبقان صلاحيات طبقة الأعمال، Feature Flags ومسار Read-Only عند انتهاء الترخيص.
- أضيفت أوامر الدورة المطلوبة: Tender Package، Revision Impact، Cost Estimation، Bid Leveling، Smart PDF Review، Submission Pack، Company/Administration وغيرها، مع إبقاء DXF/DWG والـAuto Count والأدوات غير الجاهزة Disabled بسبب واضح.
- تاب Cost Estimation مستقل يستبدل Workbooks في الواجهة، ويجمع BOQ وRate Build-Up والموارد والإنتاجية والتكاليف غير المباشرة والتسعير وسعر البيع والسيناريوهات والمراجعة والتاريخ والمخرجات.
- أوامر Recalculate وCrew/Productivity مرتبطة فعليًا بصفحة Rate Analysis، مع استمرار إعادة الحساب من محرك التكلفة المركزي وحفظ Snapshot السعر.
- أي حالة Ribbon محفوظة باسم `workbooks` من إصدار سابق تُحوّل تلقائيًا إلى `cost_estimation` عند الاستعادة.
- حفظ `workspaceScroll` و`ribbonLayout` و`ribbonHiddenCommands` داخل `uiState`. يمكن إخفاء أمر بالزر الأيمن، وتغيير عرض المجموعة بالنقر المزدوج على عنوانها، واستعادة الإعدادات من Customize Ribbon.
- اتجاه الواجهة يتبع لغة الإعدادات (`rtl` عربي / `ltr` إنجليزي)، والاختصارات المعرفة في Configuration تعمل عبر Ctrl/Alt دون إعادة تحميل مساحة العمل.

## 7. ما زال مؤجلًا قبل الإصدار التجاري الموقّع

تم إنشاء معاينة Windows x64 مضمّنة باسم `QESTIMA-Setup-0.12.0-win32-x64-Preview-Unsigned.exe`. ما زالت هناك تحديثات إنتاجية قبل الإصدار التجاري الموقّع: Code Signing، مفاتيح ترخيص الإنتاج، اختبارات أجهزة Windows الفعلية، محرك DWG المرخّص، خدمة المزامنة المركزية المستضافة، وتدقيق الواجهة العربية/الإنجليزية بالكامل.
