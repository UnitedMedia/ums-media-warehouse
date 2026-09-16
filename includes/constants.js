// Shared constants. Referenced in .sqlx as ${constants.RAW_PROJECT}.
// Files in includes/ are injected as globals into every definition file,
// named after the file: constants.js -> `constants`.

const RAW_PROJECT = "ums-digital-core-automation";

// Source datasets, one per ingestion tool. Nothing in this repo writes
// to any of these.
const DATASETS = {
  kebooladv: "kebooladv",         // CM360 + DV360 (Keboola)
  meta:      "facebook_ads_weld", // Meta (Weld)
  tiktok:    "tiktok_ads",        // TikTok (Weld) — not modelled yet
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

  core:            "core",      // cross-channel, channel-agnostic schema
  core_seeds:      "core_seeds",
  reporting:       "reporting", // cross-channel Looker Studio surface
};

// Channel labels used in the core union. Never free-typed in a model.
const CHANNEL = {
  dv360: "DV360",
  cm360: "CM360",
  meta:  "Meta",
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

module.exports = {
  RAW_PROJECT, DATASETS, SCHEMAS, CHANNEL, allPartitions,
};
