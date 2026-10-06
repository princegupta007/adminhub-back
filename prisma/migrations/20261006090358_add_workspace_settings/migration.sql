-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" UUID NOT NULL,
    "workspaceName" VARCHAR(100) NOT NULL DEFAULT 'AdminHub',
    "supportEmail" VARCHAR(255) NOT NULL DEFAULT 'support@adminhub.io',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'PST (UTC-08:00)',
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);
