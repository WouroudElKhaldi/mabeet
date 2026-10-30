-- Site-wide settings the super admin controls (one row, id 'site'). Visitors only pick light/dark and language.
CREATE TABLE "SiteSetting" (
    "id" TEXT NOT NULL DEFAULT 'site',
    "palette" TEXT NOT NULL DEFAULT 'cedar',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("id")
);
