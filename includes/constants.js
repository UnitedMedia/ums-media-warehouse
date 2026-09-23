// Shared constants. Referenced in .sqlx as ${constants.RAW_PROJECT}.
// Files in includes/ are injected as globals into every definition file,
// named after the file: constants.js -> `constants`.

const RAW_PROJECT = "ums-digital-core-automation";

// Source datasets, one per ingestion tool. Nothing in this repo writes
// to any of these.
const DATASETS = {
  kebooladv: "kebooladv",         // CM360 + DV360 (Keboola)
  meta:      "facebook_ads_weld", // Meta (Weld)
  tiktok:    "tiktok_ads",        // TikTok (Weld)
  gads:      "google_ads",        // Google Ads (Weld)
};

// Output datasets. Channel stacks keep the <channel>_<layer> pattern
// already deployed for cm360 and dv360.
//
// _seeds holds reference data. Two kinds live there and they behave
// differently — see definitions/seeds/README.md:
//   * code-defined seeds  -> type "table", rebuilt from this repo
//   * hand-maintained     -> type "operations", CREATE TABLE IF NOT
//                            EXISTS, never truncated by a run
const SCHEMAS = {
  dv360_staging:   "dv360_staging",
  dv360_seeds:     "dv360_seeds",
  dv360_marts:     "dv360_marts",
  dv360_reporting: "dv360_reporting",

  cm360_staging:   "cm360_staging",
  cm360_seeds:     "cm360_seeds",
  cm360_marts:     "cm360_marts",
  cm360_reporting: "cm360_reporting",

  meta_staging:    "meta_staging",
  meta_seeds:      "meta_seeds",
  meta_marts:      "meta_marts",
  meta_reporting:  "meta_reporting",

  tiktok_staging:   "tiktok_staging",
  tiktok_marts:     "tiktok_marts",
  tiktok_reporting: "tiktok_reporting",

  gads_staging:     "gads_staging",
  gads_marts:       "gads_marts",
  gads_reporting:   "gads_reporting",

  core:            "core",      // cross-channel, channel-agnostic schema
  core_seeds:      "core_seeds",
  reporting:       "reporting", // cross-channel Looker Studio surface
};

// Channel labels used in the core union. Never free-typed in a model.
const CHANNEL = {
  dv360: "DV360",
  cm360: "CM360",
  meta:  "Meta",
  tiktok: "TikTok",
  gads:   "Google Ads",
};

// Every partitioned fact in this project is PARTITION BY date. Some
// carry requirePartitionFilter, which means any query — including a
// downstream model — must filter on date or BigQuery refuses to run it.
// This is the filter those models use: wide enough to be a no-op,
// narrow enough to satisfy BigQuery. Written once so it is never
// fat-fingered into something that actually drops rows.
//
//   WHERE ${constants.allPartitions()}        -- unaliased
//   WHERE ${constants.allPartitions("f")}     -- f.date
function allPartitions(alias) {
  const col = alias ? `${alias}.date` : "date";
  return `${col} > DATE '2000-01-01'`;
}

// Dataform auto-creates a dataset for a `table` or `view` action, but NOT
// for an `operations` action — it just runs your SQL, and CREATE TABLE
// against a missing dataset fails instantly. The hand-maintained seeds are
// all operations, and core_seeds has nothing else in it, so its dataset
// would never exist.
//
// self() gives `project.dataset.table` already backtick-quoted. This trims
// it to `project.dataset` so an operation can create its own dataset first.
// Done here rather than inline because a .sqlx body is a JS template
// literal and a raw backtick in one would terminate it.
//
//   CREATE SCHEMA IF NOT EXISTS ${constants.schemaOf(self())}
function schemaOf(selfTarget) {
  const parts = selfTarget.split(".");
  return `${parts[0]}.${parts[1]}\``;
}

// Weld rewrites a rolling window of past days rather than only appending
// yesterday, because Google keeps attributing conversions for weeks after
// the click. Measured on google_ads.campaign_stats, 2026-09-23: every day
// from 23 August to 23 September was re-synced that morning, and each
// earlier day was last touched exactly 31 days after it happened. So the
// window is 31 days; 35 is that plus a margin.
//
// Nothing uses this yet — every mart is a full rebuild. It is defined now
// because the moment an incremental model appears (ad, keyword or search
// term level, where the volume will force it) this is the number it must
// reload, and getting it wrong means late conversions never arrive.
const WELD_LOOKBACK_DAYS = 35;

module.exports = {
  RAW_PROJECT, DATASETS, SCHEMAS, CHANNEL, allPartitions, schemaOf,
  WELD_LOOKBACK_DAYS,
};
