WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "participantId"
      ORDER BY "createdAt" DESC, "id" DESC
    ) AS position
  FROM "WordCloudVote"
)
DELETE FROM "WordCloudVote" AS vote
USING ranked
WHERE vote."id" = ranked."id" AND ranked.position > 1;

DROP INDEX "WordCloudVote_participantId_entryId_key";
CREATE UNIQUE INDEX "WordCloudVote_participantId_key"
ON "WordCloudVote"("participantId");
