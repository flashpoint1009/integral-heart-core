
## النظرة العامة

نظام ERP معياري (Modular) قابل للتخصيص الكامل من الواجهة — المطور/الأدمن يقدر يضيف ويعدل ويحذف أي بيانات (منتجات، فئات، عملاء، مخازن، طرق دفع، أدوار…) من غير ما يلمس الكود. النسخة الأولى تركّز على ثلاث ركائز: المخزون، المبيعات/الفواتير، وشاشة الكاشير (POS).

## الباك-إند (Lovable Cloud)

نفعّل Lovable Cloud ونبني الجداول دي مع RLS كامل:

- `profiles` — بيانات المستخدم (اسم، أفاتار، لغة مفضلة)
- `user_roles` — جدول منفصل للأدوار (`admin`, `manager`, `cashier`, `accountant`) + دالة `has_role()` آمنة
- `categories` — فئات المنتجات (هرمية: parent_id)
- `products` — كود، باركود، اسم AR/EN، سعر بيع، سعر تكلفة، ضريبة، وحدة، صورة، فئة
- `warehouses` — مخازن متعددة
- `inventory` — رصيد كل منتج في كل مخزن
- `stock_movements` — حركات (وارد/صادر/تحويل/تسوية) — مصدر الحقيقة للرصيد
- `customers` — عملاء (اسم، تليفون، رصيد، حد ائتمان)
- `suppliers` — موردين
- `sales_invoices` + `sales_invoice_items` — فواتير المبيعات
- `payments` — مدفوعات الفواتير (كاش/شبكة/آجل)
- `payment_methods` — قابلة للتخصيص
- `settings` — إعدادات الشركة (اسم، عملة، شعار، نسبة ضريبة، لغة افتراضية)
- `audit_log` — سجل تغييرات

كل الكتابة/القراءة من خلال `createServerFn` مع `requireSupabaseAuth` + فحص الدور المناسب.

## المصادقة والأدوار

- تسجيل دخول بالإيميل/كلمة سر + Google OAuth
- أربع أدوار: **Admin** (كل شيء + إدارة مستخدمين)، **Manager** (تقارير + إدارة عمليات)، **Cashier** (شاشة الكاشير فقط)، **Accountant** (الفواتير والمدفوعات قراءة/كتابة)
- صفحة `/auth` عامة + `_authenticated` layout للباقي
- شاشة Settings → Users & Roles لإدارة الصلاحيات من الواجهة

## الشاشات (v1)

```text
/auth                       تسجيل دخول/تسجيل
/                           Dashboard — KPIs (مبيعات اليوم/الشهر، أكثر منتج، أقل مخزون)
/pos                        شاشة كاشير full-screen (بحث بالباركود، سلة، دفع، طباعة)
/products                   قائمة + CRUD + استيراد/تصدير CSV
/products/categories        إدارة الفئات
/inventory                  أرصدة المخازن + حركات + تحويل + تسوية + جرد
/sales                      فواتير المبيعات (قائمة + فلترة + تفاصيل)
/sales/new                  إنشاء فاتورة يدوية
/customers                  CRUD عملاء + كشف حساب
/reports                    تقارير: مبيعات يومية/شهرية، أرباح، مخزون راكد
/settings                   إعدادات الشركة، طرق الدفع، الضريبة، اللغة
/settings/users             إدارة المستخدمين والأدوار
```

كل قائمة فيها: بحث + فلترة + ترتيب + Pagination + Bulk actions + Export CSV.

## التخصيص الكامل (المطلب المهم)

- كل entity (منتج، فئة، عميل، مخزن، طريقة دفع، دور) عنده شاشة CRUD كاملة في الواجهة — مفيش بيانات hard-coded
- جدول `settings` JSON-flexible عشان نضيف أي إعداد جديد من غير migration
- نظام **Custom Fields** على المنتجات والعملاء (الأدمن يضيف حقول إضافية من Settings)
- Theming من الإعدادات (لون primary + شعار)

## اللغة (AR/EN + RTL/LTR)

- مكتبة `i18next` + `react-i18next`
- toggle في الـ navbar يخزّن التفضيل في `profiles.locale`
- `dir="rtl"` ديناميكي على الـ `<html>`
- كل النصوص في ملفات `locales/ar.json` و `locales/en.json`

## الستاك التقني

- TanStack Start (موجود) + TanStack Query للـ data fetching
- Shadcn Sidebar للـ layout الأساسي
- `createServerFn` لكل عمليات الـ DB (مفيش queries مباشرة من المكونات)
- Zod للـ validation على الكلاينت والسيرفر
- `react-hook-form` للنماذج
- `recharts` للتقارير
- طباعة الفواتير: `react-to-print` + قالب HTML قابل للتخصيص

## التصميم

- ثيم احترافي data-dense (مش marketing): sidebar مظلل، محتوى نظيف، جداول واضحة
- Design tokens في `src/styles.css` بصيغة `oklch` — primary أزرق هادي، accent أخضر للنجاح
- خطوط: **Cairo** للعربي، **Inter** للإنجليزي
- وضع ليلي افتراضي للكاشير (أقل إجهاد للعين)

## خطة التنفيذ (مراحل)

### المرحلة 1 — الأساس (هاعملها أول حاجة)
1. تفعيل Lovable Cloud + إنشاء كل الـ tables + RLS + roles
2. Auth (Email + Google) + صفحة `/auth` + `_authenticated` layout
3. Layout أساسي بـ Sidebar + Topbar + Language toggle + i18n setup
4. Dashboard بـ KPIs placeholder

### المرحلة 2 — المنتجات والمخزون
5. شاشة Categories CRUD
6. شاشة Products CRUD (مع رفع صور)
7. شاشة Warehouses + Inventory + Stock movements

### المرحلة 3 — المبيعات والكاشير
8. شاشة Customers CRUD
9. شاشة Sales Invoices (قائمة + إنشاء يدوي + طباعة)
10. شاشة POS (كاشير) كاملة

### المرحلة 4 — التقارير والإعدادات
11. شاشة Reports
12. شاشة Settings + Users & Roles

## ملاحظة مهمة

عشان أضمن الجودة، **هابدأ النهارده بالمرحلة 1 كاملة** (الأساس: Cloud + Auth + Layout + Dashboard فاضي). بعدها تقولي "كمّل" وأنا أنفّذ المرحلة 2، وهكذا. ده أحسن من إني أعمل كل حاجة في رسالة واحدة وتطلع نص شغّالة.

موافق على الخطة دي؟ ولا عايز تعدّل حاجة (تشيل موديول، تضيف موديول زي المشتريات أو الموردين من البداية، تغيّر الأدوار…)؟
