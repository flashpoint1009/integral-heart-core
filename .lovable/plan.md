
## نظرة عامة

نضيف **دور جديد "مندوب" (sales_rep)** + واجهة موبايل خفيفة على نفس المشروع تحت `/rep/*` (PWA installable)، ولوحة إشراف للمدير تحت `/supervisor`. كل البيع من المخزن المركزي (online فقط)، والعملاء الجدد يتسجلوا فوراً بدون اعتماد.

## قاعدة البيانات (Migration واحد)

أضيف الأعمدة/الجداول:

- **employees**: عمود `user_id (uuid)` لربط الموظف بحساب auth + `assigned_supervisor_id`
- **customers**: عمود `assigned_rep_id` (الراجع للموظف) + `lat`, `lng`, `address_notes`
- **app_role enum**: إضافة قيمة `'sales_rep'` و `'supervisor'`
- **rep_check_ins** جدول جديد: `employee_id, check_in_at, check_out_at, lat, lng, address`
- **rep_visits** جدول جديد: `employee_id, customer_id, visited_at, lat, lng, duration_sec, notes, outcome (sold/no_sale/not_found), invoice_id (nullable)`
- **rep_routes** جدول جديد: `employee_id, route_date, customer_id, sequence, status (pending/done/skipped)` — المشرف يخطط، المندوب ينفذ
- **sales_invoices**: عمود `rep_id` (المندوب اللي عمل الفاتورة) + `visit_id`

RLS:
- المندوب يشوف عملاءه + خط سيره + فواتيره + حضوره فقط
- المشرف يشوف كل مندوبيه
- الأدمن يشوف الكل

## واجهة المندوب `/rep/*`

تطبيق موبايل-أولاً (responsive)، مع manifest + أيقونات للتثبيت على الموبايل:

```text
/rep                    → Dashboard (حضور اليوم، عدد الزيارات، مبيعات اليوم)
/rep/attendance         → زر تسجيل دخول/خروج (يلتقط GPS)
/rep/route              → خط سير اليوم (قائمة عملاء بالترتيب + خريطة)
/rep/customers          → كل عملاء المندوب + بحث + إضافة جديد
/rep/customers/$id      → كارت العميل + زر "بدء زيارة" + تاريخ المعاملات
/rep/visit/$id          → شاشة زيارة نشطة: بيع فوري | تحصيل | ملاحظة | إنهاء
/rep/sale               → POS مبسط (منتجات + كمية + سعر + حفظ → فاتورة)
/rep/invoice/$id        → معاينة + طباعة
```

ملامح مهمة:
- زر "بدء يوم" يفتح GPS ويسجل check-in
- كل زيارة تطلب الـ GPS وتقفل الموقع
- بيع من شاشة الزيارة → فاتورة مرتبطة بالعميل والمندوب والزيارة تلقائياً
- طباعة A4 بتعمل `window.print()` (موجودة فعلاً) + هيدر مختصر مناسب للورق الحراري

## لوحة المشرف `/supervisor` (تظهر في القائمة لو دوره supervisor/admin)

```text
/supervisor              → Dashboard (مندوبين نشطين الآن، مبيعات اليوم/مندوب)
/supervisor/live         → خريطة حية بآخر موقع لكل مندوب
/supervisor/routes       → تخطيط خطوط السير (سحب وإفلات عملاء على مندوب/يوم)
/supervisor/reports      → تقارير: زيارات منفذة vs مخططة، مبيعات/مندوب، تحصيلات
/supervisor/customers    → كل العملاء + إعادة تخصيص لمندوب
```

## تكامل مع النظام الحالي

- **المخزون**: البيع من المخزن المركزي الافتراضي → الـ triggers الحالية تخصم تلقائياً
- **القيود المحاسبية**: فواتير المندوب تمر بنفس `tg_sales_invoice_journal` → تسجل في اليومية تلقائياً
- **الحضور**: `rep_check_ins` بتسجل تلقائياً في جدول `attendance` كـ "present" لما المندوب يعمل check-in
- **HR**: المندوب موظف عادي بـ `user_id` مربوط — كل قواعد المرتبات والإجازات شغالة

## PWA (تثبيت كأيقونة)

- إضافة `public/manifest.webmanifest` بـ `display: standalone`
- أيقونات (نولدها)
- meta tags في `__root.tsx`
- **بدون** service worker (لإن المستخدم اختار online فقط) — التثبيت كفاية للتجربة الموبايل

## التنفيذ على مراحل

**المرحلة 1** (نبدأ بيها دلوقتي):
1. Migration: الأدوار + الجداول الجديدة + RLS
2. تحديث الـ topbar/sidebar لإخفاء العناصر اللي مش من حق المندوب
3. صفحات `/rep/attendance` + `/rep/customers` + `/rep/sale` + `/rep/route`
4. PWA manifest + أيقونات

**المرحلة 2**:
5. زيارات + GPS tracking + طباعة الفاتورة
6. لوحة المشرف: live map + reports
7. تخطيط خطوط السير (drag & drop)

## ملاحظات تقنية

- GPS عبر `navigator.geolocation` (متاح في PWA على الموبايل)
- الخرائط: Leaflet + OpenStreetMap (مجاني، بدون API key)
- الموبايل-أولاً: نستخدم Tailwind responsive + bottom navigation للـ /rep
- لو احتجنا لاحقاً Capacitor لطباعة بلوتوث/خلفية → نفس الكود يتغلف في APK

---

**أبدأ بالمرحلة 1 دلوقتي؟**
