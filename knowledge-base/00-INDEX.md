# 📚 Knowledge Base — Grocery System

> هذا المجلد يحتوي على التحليل الهندسي الكامل للمستودع، يُستخدم كـ **سياق ثابت** لا يُنسى عبر الجلسات.
> آخر تحديث: 2026-05-02

## الفهرس

| الملف | المحتوى |
|-------|---------|
| `00-INDEX.md` | هذا الملف — فهرس كامل |
| `01-repository-analysis.md` | تحليل البنية + Stack + ما تم وما تبقى |
| `02-locked-decisions.md` | القرارات المُقفلة (مأخوذة من docs/12-agent-memory.md) |
| `03-prisma-schema-inventory.md` | جرد كامل لجميع الـ 14 model |
| `04-backend-modules-status.md` | حالة كل module في NestJS API |
| `05-frontend-pages-status.md` | حالة كل page/component في React Web |
| `06-permissions-catalog.md` | الـ 181 permissions + الـ 19 module |
| `07-gap-analysis-todo.md` | ⭐ ما المتبقي بدقة لإكمال المشروع |
| `08-execution-plan.md` | خطة تنفيذ Phase 3 Frontend + Phase 4 |
| `09-conventions-patterns.md` | الأنماط والاتفاقيات الواجب اتباعها |
| `10-audit-report.md` | ⭐ تقرير Audit (Part A) — مخرج البرومبت |

## مرجع سريع

- **Branch الحالي**: `genspark_ai_developer` (default)
- **Branch المستهدف**: `phase34_completion` (سننشئه)
- **آخر commit**: `3f5eb1c Merge pull request #5 from moain2026/genspark_recovery`
- **عدد الـ models**: 14 (Store, Setting, User, Role, Permission, RolePermission, UserRole, RefreshToken, IdempotencyKey, AuditLog, Customer, CustomerTransaction, CustomerReminderSettings, Notification)
- **عدد migrations**: 2 (`init_phase2_auth`, `p3_customers_notifications`)
- **عدد tests الحالية (تقريبي حسب recovery-report)**: 208 (shared 69 + api 70 + web 69)

## القرارات الحرجة (Don't Forget)

1. ✋ **لا حذف نهائي** للعمليات المالية (cancelledAt + deletedAt فقط)
2. 🛡️ **كل العمليات المالية** عبر `prisma.$transaction` + audit log
3. 🔒 **`SELECT … FOR UPDATE`** على balance updates
4. 🚫 **الفرونت لا يحدّث الأرصدة** — فقط الباكند
5. 🆔 **Idempotency-Key** على POST/PUT/PATCH/DELETE حساس
6. 💰 **Cash Purchase** = purchase فقط (لا expense ولا تغيير في رصيد المورد)
7. 💳 **Credit Purchase** = purchase + supplier_transaction (دين+) + تحديث رصيد
8. 🎨 **Color**: Emerald-600 (#059669)
9. 🔤 **Font**: IBM Plex Sans Arabic Variable (self-hosted)
10. 📱 **Breakpoint**: 768px (Modal ↔ BottomSheet)
11. 🔢 **Numerals**: Latin (0-9) قاطعاً
12. 🌐 **All UI strings** بالعربية، logs بالإنجليزية
