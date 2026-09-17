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

// ---------------------------------------------------------------------
// tiktok_ads — Weld sync for TikTok
//
// Weld lands 41 tables. TikTok publishes the SAME money at every level of
// the hierarchy (ad -> ad group -> campaign) AND at every time grain
// (hourly / daily / weekly / monthly) AND per breakdown — 21 report
// tables carrying identical metrics. Only the finest grain of each is
// declared; the rest are derivable and staging any of them would create
// a second source of truth for one number.
//
// NOTE: `ad` and `campaign` are also the names of Meta tables in
// facebook_ads_weld. Every reference to either is dataset-qualified, as
// the README requires. A bare ref() would not compile.
// ---------------------------------------------------------------------
const TIKTOK_TABLES = [
  // entities — keyed on `id`, not <entity>_id
  "advertiser",            // the ONLY table carrying currency
  "campaign",
  "ad_group",
  "ad",

  // facts
  "campaign_daily_report", // COMPLETE spend — the source of truth
  "ad_daily_report",       // the detail. ~98.6% of spend; TikTok cannot
                           // attribute the rest to a named ad.
  "ad_hourly_report",      // dayparting

  // breakdowns — each a different slice of the SAME spend
  "ad_age_gender_report",
  "ad_country_report",
  "ad_language_report",
  "campaign_platform_report", // platform exists only at campaign level
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

TIKTOK_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.tiktok,
    name: name,
  });
});

// Deliberately NOT declared, and why:
//   * every *_weekly_report and *_monthly_report — DATE_TRUNC on the
//     daily fact gives the same numbers
//   * ad_group_* and campaign_* hourly/daily reports — rollups of
//     ad_daily_report; campaign_daily_report is declared only because it
//     is COMPLETE where the ad report is not
//   * campaign_age_gender / country / language reports — the ad-level
//     versions rolled up
//   * the 13 ad_group_* targeting tables (audience, interest, location,
//     placement...) — one-to-many attribute lists. Joining one to a fact
//     fans rows out. Revisit if someone asks for targeting analysis.
//   * ad_group_split_test and the three gmv_max_* tables — 0 rows,
//     untouched since 2026-09-02. GMV Max is TikTok Shop, a different
//     product with `cost` instead of `spend`; it gets its own stack if
//     it ever fills.
