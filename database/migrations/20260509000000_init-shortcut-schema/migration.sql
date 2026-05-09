-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortcuts" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "context" TEXT,

    CONSTRAINT "shortcuts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortcut_key_bindings" (
    "id" TEXT NOT NULL,
    "shortcutId" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,

    CONSTRAINT "shortcut_key_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shortcut_key_steps" (
    "id" TEXT NOT NULL,
    "bindingId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "keyCombo" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "modifiers" TEXT[],

    CONSTRAINT "shortcut_key_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_name_key" ON "platforms"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "applications_slug_key" ON "applications"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "shortcut_key_bindings_shortcutId_platformId_key" ON "shortcut_key_bindings"("shortcutId", "platformId");

-- CreateIndex
CREATE UNIQUE INDEX "shortcut_key_steps_bindingId_stepOrder_key" ON "shortcut_key_steps"("bindingId", "stepOrder");

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortcuts" ADD CONSTRAINT "shortcuts_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortcut_key_bindings" ADD CONSTRAINT "shortcut_key_bindings_shortcutId_fkey" FOREIGN KEY ("shortcutId") REFERENCES "shortcuts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortcut_key_bindings" ADD CONSTRAINT "shortcut_key_bindings_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shortcut_key_steps" ADD CONSTRAINT "shortcut_key_steps_bindingId_fkey" FOREIGN KEY ("bindingId") REFERENCES "shortcut_key_bindings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
