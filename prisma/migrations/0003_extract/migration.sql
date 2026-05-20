-- Migration: 0003_extract
-- Adds the extracted_queries table (Stage 1 output, per PRD §11.3 + ADR-0002).
-- One row per Query (1:1). User-editable before Stage 2; confirmed_at fires the
-- queries.state → confirmed transition.

CREATE TABLE "extracted_queries" (
    "query_id"       UUID         NOT NULL,
    "extracted_json" JSONB        NOT NULL,
    "user_edited"    BOOLEAN      NOT NULL DEFAULT false,
    "confirmed_at"   TIMESTAMPTZ(6),
    "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "extracted_queries_pkey" PRIMARY KEY ("query_id")
);

ALTER TABLE "extracted_queries"
    ADD CONSTRAINT "extracted_queries_query_id_fkey"
    FOREIGN KEY ("query_id") REFERENCES "queries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
