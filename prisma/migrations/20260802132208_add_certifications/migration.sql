-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminCertification" (
    "id" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminCertification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCertificationRequirement" (
    "id" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCertificationRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Certification_name_key" ON "Certification"("name");

-- CreateIndex
CREATE INDEX "AdminCertification_adminId_idx" ON "AdminCertification"("adminId");

-- CreateIndex
CREATE INDEX "AdminCertification_certificationId_idx" ON "AdminCertification"("certificationId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminCertification_adminId_certificationId_key" ON "AdminCertification"("adminId", "certificationId");

-- CreateIndex
CREATE INDEX "ProjectCertificationRequirement_projectId_idx" ON "ProjectCertificationRequirement"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCertificationRequirement_certificationId_idx" ON "ProjectCertificationRequirement"("certificationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCertificationRequirement_projectId_certificationId_key" ON "ProjectCertificationRequirement"("projectId", "certificationId");

-- AddForeignKey
ALTER TABLE "AdminCertification" ADD CONSTRAINT "AdminCertification_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCertification" ADD CONSTRAINT "AdminCertification_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminCertification" ADD CONSTRAINT "AdminCertification_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCertificationRequirement" ADD CONSTRAINT "ProjectCertificationRequirement_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "Certification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCertificationRequirement" ADD CONSTRAINT "ProjectCertificationRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
