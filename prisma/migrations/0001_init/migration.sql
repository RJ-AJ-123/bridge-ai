-- Migration: 0001_init
-- Placeholder schema for the bootstrap slice. Real schema lands in later slices (#02 onwards).

-- CreateEnum
CREATE TYPE "QueryMode" AS ENUM ('company', 'city');

-- CreateEnum
CREATE TYPE "QueryState" AS ENUM ('draft', 'extracting', 'extracted', 'confirmed', 'enriching', 'enriched', 'building_graph', 'scoring', 'rendering', 'done', 'cancelled', 'failed');

-- CreateTable
CREATE TABLE "queries" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "mode" "QueryMode" NOT NULL,
    "payload_json" JSONB NOT NULL,
    "state" "QueryState" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queries_pkey" PRIMARY KEY ("id")
);
