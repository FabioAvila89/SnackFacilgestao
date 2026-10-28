-- CreateIndex
CREATE INDEX "Account_active_idx" ON "Account"("active");

-- CreateIndex
CREATE INDEX "Account_type_idx" ON "Account"("type");

-- CreateIndex
CREATE INDEX "Category_active_idx" ON "Category"("active");

-- CreateIndex
CREATE INDEX "Category_kind_idx" ON "Category"("kind");

-- CreateIndex
CREATE INDEX "Category_dreLine_idx" ON "Category"("dreLine");

-- CreateIndex
CREATE INDEX "Supplier_active_idx" ON "Supplier"("active");

-- CreateIndex
CREATE INDEX "Supplier_document_idx" ON "Supplier"("document");

-- CreateIndex
CREATE INDEX "Transaction_date_kind_status_idx" ON "Transaction"("date", "kind", "status");

-- CreateIndex
CREATE INDEX "Transaction_dueDate_status_idx" ON "Transaction"("dueDate", "status");

-- CreateIndex
CREATE INDEX "Transaction_accountId_date_idx" ON "Transaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_date_idx" ON "Transaction"("categoryId", "date");

-- CreateIndex
CREATE INDEX "Transaction_isRecurring_idx" ON "Transaction"("isRecurring");

