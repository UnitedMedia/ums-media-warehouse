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

  // The ONLY breakdown carrying campaign_id. Appeared 2026-10-02 and does
  // not follow the connector's demographics_* naming, so it is almost
  // certainly a hand-built Weld model rather than a standard sync — treat
  // it as something that can change without notice.
  //
  // ROLLING 7-DAY WINDOWS, not days. There is no `date` column: every row
  // spans date_start..date_stop = 6 days, and a new window starts EVERY
  // DAY. All 723,638 rows overlap six of their neighbours, so an unfiltered
  // SUM(spend) returns 28.3M against a true ~3.8M. stg_meta_age_gender
  // keeps only Monday starts, which tile the calendar exactly once.
  // Verified 2026-10-02 against ad_roas_insight: every campaign ratio
  // 1.000, diff 0.00.
  "age_gender",

  "demographics_age_and_gender",             // no ad_id
  "demographics_age_and_gender_actions",     // conversions at age x gender.
                                             // The ONLY way to get post
                                             // engagements and leads at this
                                             // grain. Also has no ad_id.
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

// ---------------------------------------------------------------------
// google_ads — Weld sync for Google Ads
//
// PHASE 1: campaign level only, which is what the cross-channel view
// needs. Ad groups and ads come next, keywords and search terms after.
//
// Two things are specific to this source:
//   * rows are SOFT DELETED. Every stats table carries _weld_deleted_at
//     and staging must filter `_weld_deleted_at IS NULL`. No other source
//     in this project does this — checked 2026-09-23, the column exists
//     in 14 google_ads tables and in none of facebook_ads_weld or
//     tiktok_ads.
//   * `account` and `campaign` are ALSO Meta and TikTok table names.
//     Three datasets, one name. Every ref is dataset-qualified.
// ---------------------------------------------------------------------
const GOOGLE_ADS_TABLES = [
  "account",         // the only source of currency_code, and of the
                     // manager / test_account flags
  "campaign",        // carries REAL booked start_date and end_date
  "campaign_stats",  // COMPLETE spend. Performance Max exists at this
                     // level and nowhere below it.

  // PHASE 2
  "account_stats",   // the true account total. Reconciled against
                     // campaign_stats to catch spend no campaign claims.
  "ad_group",
  "ad_group_stats",
  "ad_stats",        // the only stats table with video_views
  "campaign_budget", // booked budget + Google's own recommendation
  "campaign_bidding_strategy", // bid strategy and its targets. NOTE: its
                     // target_impression_share_* columns are SETTINGS.
                     // Achieved impression share, and impression share
                     // lost to budget or rank, are not synced at all.

  // PHASE 2b
  "ad",              // ad type, status, URLs, ad_strength and policy
                     // approval. NO creative text — Weld syncs 23 columns
                     // and none of them is a headline or description.
  "ad_group_criterion", // keywords and the FULL Quality Score: score,
                     // expected CTR, ad relevance, landing page. Current
                     // state, no date.
  "audience_stats",  // audience performance, keyed on criterion_id. The
                     // audience NAME is not in it — that needs user_list,
                     // user_interest or topic, which are not declared yet.
];

// ---------------------------------------------------------------------
// FINAL_TABLES — hand-built reference data that predates this project
// ---------------------------------------------------------------------
const FINAL_TABLES = [
  "MonthlyExchangeRate",  // Date (first of month) + ExchangeRate. No
                          // currency column: it is implicitly RON per
                          // 1 EUR. Covers 2026-04 onwards.
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

GOOGLE_ADS_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.gads,
    name: name,
  });
});

FINAL_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.final,
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
