ALTER TABLE "User" ADD COLUMN "isDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Quiz" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "Room"
  ADD COLUMN "activityTitle" TEXT,
  ADD COLUMN "activityType" "ActivityType",
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Room" AS room
SET
  "activityTitle" = quiz."title",
  "activityType" = quiz."type",
  "startedAt" = CASE WHEN room."status" <> 'LOBBY' THEN room."createdAt" ELSE NULL END,
  "endedAt" = CASE WHEN room."status" = 'FINISHED' THEN room."createdAt" ELSE NULL END
FROM "Quiz" AS quiz
WHERE quiz."id" = room."quizId";

ALTER TABLE "Room"
  ALTER COLUMN "activityTitle" SET NOT NULL,
  ALTER COLUMN "activityType" SET NOT NULL;

DROP INDEX "Quiz_ownerId_idx";
DROP INDEX "Room_hostId_idx";
CREATE INDEX "Quiz_ownerId_deletedAt_idx" ON "Quiz"("ownerId", "deletedAt");
CREATE INDEX "Room_hostId_status_createdAt_idx" ON "Room"("hostId", "status", "createdAt");
CREATE INDEX "Room_activityType_startedAt_idx" ON "Room"("activityType", "startedAt");
CREATE INDEX "Room_status_endedAt_idx" ON "Room"("status", "endedAt");

ALTER TABLE "Room"
ADD CONSTRAINT "Room_hostId_fkey"
FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_adminId_createdAt_idx" ON "AdminAuditLog"("adminId", "createdAt");
CREATE INDEX "AdminAuditLog_targetUserId_createdAt_idx" ON "AdminAuditLog"("targetUserId", "createdAt");

ALTER TABLE "AdminAuditLog"
ADD CONSTRAINT "AdminAuditLog_adminId_fkey"
FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdminAuditLog"
ADD CONSTRAINT "AdminAuditLog_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
