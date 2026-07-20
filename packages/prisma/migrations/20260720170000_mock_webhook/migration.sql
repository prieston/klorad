-- CreateTable
CREATE TABLE "MockWebhook" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[],
    "secret" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDeliveryAt" TIMESTAMP(3),
    "lastDeliveryStatus" INTEGER,

    CONSTRAINT "MockWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockWebhook_active_idx" ON "MockWebhook"("active");
