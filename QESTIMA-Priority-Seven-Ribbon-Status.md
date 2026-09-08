# QESTIMA — Priority 7 Ribbon Status

تمت إعادة تنظيم الواجهة لتصبح Ribbon من مستويين، بأسلوب برامج التسعير الاحترافية:

## التابات الرئيسية الثابتة

1. **File** — إنشاء/فتح المشروع، الاستيراد، التصدير، Backup وRestore.
2. **Home** — Projects Center، Project Data، الحفظ، Undo/Redo، Control Center وQuality Gate.
3. **Drawings** — عرض الرسومات، الاستيراد، التنقل، IFC/Model Mapping ومراجعة الكميات.
4. **Dimensions** — Length، Area، Perimeter، Count، Dimension Groups وQuantity Review.
5. **Revisions** — Revision Manager، حفظ Snapshot وتحليل الأثر.
6. **Cost Estimation** — BOQ، Rate Build-Up، Resources، Productivity، Indirect Cost، Selling Price، Scenarios وQuality Check.
7. **Suppliers** — RFQs، عروض الموردين، Markup والـWhat‑If التجاري.
8. **Intelligence** — Smart BOQ Import، Historical Matching، Rate Assemblies، Quality Checker وBid Leveling.
9. **Reports** — Report Center، Excel، Tender Submission Pack، Quality Gate، Revision Impact وRisks/Gaps.
10. **Administration** — Backup، Diagnostics، Team Control، Owner Portal، الأجهزة وCentral API.

كل تاب رئيسي يفتح Command Strip مستقلًا أسفله. تم نقل IFC/Model إلى مجموعة Drawings، ونقل RFQ/Markup إلى Suppliers، وإضافة Reports كتاب مستقل حتى لا تتجاوز الواجهة عشرة تابات.

## السلوك

- الضغط على أي تاب يغيّر مجموعة الأوامر أسفله فورًا.
- التابات تستخدم بنية `tablist` / `tabpanel` مع حالة نشطة واضحة ودعم التنقل بلوحة المفاتيح، دون تغيير مسار العمل.
- الضغط على أمر يفتح شاشة العمل المرتبطة، وليس شاشة Dashboard عامة.
- فتح BOQ أو الرسومات أو الموردين أو التقارير يحدد تلقائيًا التاب المناسب.
- الـSidebar وWorkspace Tabs ما زالا متاحين كمسارات بديلة، بينما Cost Estimation هو مسار التسعير الرئيسي.
- تم تطبيق شكل الواجهة المقترح داخل المصدر: Chrome داكن، Accent ذهبي، Ribbon مدمج، Workbooks متعددة، BOQ Grid كثيف وRate Inspector مثبت. بعد تسجيل الدخول يفتح Cost Estimation/BOQ كمساحة العمل الأولى.
- حافظت الترقية على سير العمل الحالي: Tender Review → BOQ → Takeoff → Pricing → RFQ → Quality → Reports.

## التحقق

- تم فحص أن عدد التابات الرئيسية = 10 وأن لكل تاب Panel مطابقًا.
- تم تحديث UI smoke test للتحقق من الأسماء والترتيب وعدم وجود Models/Subcontractors كتطبيقات رئيسية منفصلة.
- تم اختبار ربط كل تاب بالـPanel المقابل، بما في ذلك حالات `aria-selected` و`aria-controls`.
- لا يوجد إصدار Installer جديد في هذه المرحلة؛ التعديل محفوظ في المصدر فقط إلى أن تكتمل قائمة تحديثات الإنتاج والتوقيع.
