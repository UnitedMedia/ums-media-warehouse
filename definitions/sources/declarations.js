// Source declarations. Declaring a table tells Dataform it exists but is
// not managed here — nothing in this repo ever writes to kebooladv or
// facebook_ads_weld. ref("fct_dv360_lineitem_daily_v5") resolves to it,
// and the dependency graph knows staging sits downstream of ingestion.
//
// A table that is not declared cannot be ref()'d. Hard-coding a fully
// qualified name in a model instead is what breaks lineage, so don't.

// ---------------------------------------------------------------------
// kebooladv — Keboola extractions for DV360 and CM360
// ---------------------------------------------------------------------
const KEBOOLA_TABLES = [
  // DV360
  "fct_dv360_lineitem_daily_v5",  // backbone — the only table with
                                  // Partner, Campaign, Invalid_Clicks,
                                  // Total_Conversions and Revenue_USD
  "fct_dv360_creative_daily",
  "fct_dv360_inventory_daily",    // ONE day of data as of 2026-08-25
  "fct_dv360_placement_daily",
  "fct_dv360_geo_daily",          // Country only, ~61 rows/month
  "fct_dv360_timeofday_daily",
  "fct_dv360_reach_daily",        // NON-ADDITIVE
  "fct_dv360_floodlight_daily",   // currently EMPTY — see README
  "fct_dv360_youtube_daily",      // deliberately not staged: it would be
                                  // a second source of truth for
                                  // TrueView views. Declared so the
                                  // graph shows we know it is there.

  // CM360
  "cm360_hourly",                 // backbone — every CM360 dimension
  "cm360_standard_table",         // thin; only source of totalConversions
  "cm360_reach",                  // NON-ADDITIVE; also the only table
                                  // carrying advertiserId and advertiser
                                  // name on the same row
];

// ---------------------------------------------------------------------
// facebook_ads_weld — Weld sync for Meta
//
// Weld lands ~137 tables. Only the ones below survive consolidation;
// declaring the rest would put noise in the graph for no gain.
// Every one of these carries _weld_synced, which staging uses to
// de-duplicate re-syncs.
// ---------------------------------------------------------------------
const META_TABLES = [
  // facts
  "ad_roas_insight",                // ad x day metrics
  "ad_roas_insight_actions",        // ad x day x action_type counts
  "ad_roas_insight_action_values",  // ad x day x action_type money

  // entities
  "account",
  "campaign",
  "ad_set",
  "ad",
  "creative",
  "custom_conversion",              // resolves offsite_conversion.custom.<id>

  // breakdowns — each a different slice of the SAME spend.
  // Never union these with the ad-level fact.
  "demographics_age_and_gender",             // no ad_id
  "demographics_country_ad",
  "demographics_delivery_platform_ad",
  "demographics_delivery_platform_and_device", // no ad_id
  "demographics_region",                       // no ad_id
];

KEBOOLA_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.kebooladv,
    name: name,
  });
});

META_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.meta,
    name: name,
  });
});

// TikTok is next. When it lands, add a TIKTOK_TABLES block against
// constants.DATASETS.tiktok and a definitions/staging/tiktok/ folder.
// Nothing else in this repo needs to change.
