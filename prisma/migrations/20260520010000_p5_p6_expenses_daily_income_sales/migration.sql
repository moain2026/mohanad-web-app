-- ─────────────────────────────────────────────────────────────
--  Phase 5 + Phase 6 — Expenses, Daily Income, Sales
--
--  Phase 5 (P5-1):
--    • expense_categories            (per-store category catalog)
--    • expenses                      (3 modes: NORMAL / SUPPLIER_PAYMENT / CASH_PURCHASE_LINK)
--    • daily_income                  (per-day aggregate, unique on (store_id, date))
--    • ExpenseType enum
--
--  Phase 6 (P6-1):
--    • sales                         (3 modes: QUICK / DETAILED / CREDIT)
--    • sale_items
--    • SaleMode enum
--
--  Notes:
--    • CASH_PURCHASE_LINK expenses reference an existing purchases.id row.
--      Daily-income aggregation MUST read cash purchases from `purchases`,
--      not from expenses, to avoid double-counting (locked rule).
--    • CREDIT sales atomically create a customer_transactions(DEBT) row and
--      bump customers.current_balance — wiring lives in the API service layer.
--    • Hand-written because the genspark sandbox has no PostgreSQL, so
--      `prisma migrate dev` cannot generate it. SQL kept stylistically
--      identical to the auto-generated p3/p4 migrations so a later
--      `prisma migrate diff` against this schema produces an empty diff.
-- ─────────────────────────────────────────────────────────────

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('NORMAL', 'SUPPLIER_PAYMENT', 'CASH_PURCHASE_LINK');

-- CreateEnum
CREATE TYPE "SaleMode" AS ENUM ('QUICK', 'DETAILED', 'CREDIT');

-- CreateTable
CREATE TABLE "expense_categories" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "expense_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_income" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "opening_cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cash_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "customer_payments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cash_purchases" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "supplier_payments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "normal_expenses" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closing_cash" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_income_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "mode" "SaleMode" NOT NULL,
    "customer_id" TEXT,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "has_items" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_id" TEXT,
    "cancel_reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(14,2) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "total_price" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_store_id_name_key" ON "expense_categories"("store_id", "name");

-- CreateIndex
CREATE INDEX "expense_categories_store_id_idx" ON "expense_categories"("store_id");

-- CreateIndex
CREATE INDEX "expense_categories_is_active_idx" ON "expense_categories"("is_active");

-- CreateIndex
CREATE INDEX "expense_categories_deleted_at_idx" ON "expense_categories"("deleted_at");

-- CreateIndex
CREATE INDEX "expenses_store_id_expense_date_idx" ON "expenses"("store_id", "expense_date");

-- CreateIndex
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");

-- CreateIndex
CREATE INDEX "expenses_type_idx" ON "expenses"("type");

-- CreateIndex
CREATE INDEX "expenses_cancelled_at_idx" ON "expenses"("cancelled_at");

-- CreateIndex
CREATE INDEX "expenses_reference_type_reference_id_idx" ON "expenses"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_income_store_id_date_key" ON "daily_income"("store_id", "date");

-- CreateIndex
CREATE INDEX "daily_income_store_id_date_idx" ON "daily_income"("store_id", "date");

-- CreateIndex
CREATE INDEX "daily_income_closed_at_idx" ON "daily_income"("closed_at");

-- CreateIndex
CREATE INDEX "sales_store_id_idx" ON "sales"("store_id");

-- CreateIndex
CREATE INDEX "sales_customer_id_idx" ON "sales"("customer_id");

-- CreateIndex
CREATE INDEX "sales_mode_idx" ON "sales"("mode");

-- CreateIndex
CREATE INDEX "sales_created_at_idx" ON "sales"("created_at");

-- CreateIndex
CREATE INDEX "sales_cancelled_at_idx" ON "sales"("cancelled_at");

-- CreateIndex
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items"("sale_id");

-- CreateIndex
CREATE INDEX "sale_items_product_id_idx" ON "sale_items"("product_id");

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_income" ADD CONSTRAINT "daily_income_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_income" ADD CONSTRAINT "daily_income_closed_by_id_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_cancelled_by_id_fkey" FOREIGN KEY ("cancelled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;
