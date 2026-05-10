-- CreateTable: collections
CREATE TABLE "collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable: collection_shortcuts
CREATE TABLE "collection_shortcuts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "shortcutId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_shortcuts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collection_shortcuts_collectionId_shortcutId_key" ON "collection_shortcuts"("collectionId", "shortcutId");

-- AddForeignKey: collections.userId → users.id
ALTER TABLE "collections" ADD CONSTRAINT "collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: collection_shortcuts.collectionId → collections.id
ALTER TABLE "collection_shortcuts" ADD CONSTRAINT "collection_shortcuts_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: collection_shortcuts.shortcutId → shortcuts.id
ALTER TABLE "collection_shortcuts" ADD CONSTRAINT "collection_shortcuts_shortcutId_fkey" FOREIGN KEY ("shortcutId") REFERENCES "shortcuts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
