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
  // DV360. Keboola created this set on 2026-10-13 alongside the old
  // fct_dv360_*_daily tables, with IDENTICAL schemas -- every column name
  // and type matches -- and far more data:
  //
  //   lineitem     72 rows ->  1,581      placement  12,584 -> 119,123
  //   geo           1 row  -> 37,198      inventory   1,047 -> 308,362
  //   creative    379      ->  5,909      timeofday   1,647 ->  22,841
  //
  // The old tables carried ONE day; these carry FOURTEEN, 2026-09-28 to
  // 2026-10-11. fct_dv360_inventory_daily had already stopped updating.
  //
  // A happy side effect: the old names collided with this project's own
  // mart names (dv360_marts.fct_dv360_placement_daily and the Keboola
  // table were both "fct_dv360_placement_daily"), which is what forced
  // six refs to be dataset-qualified. The new names do not collide.
  "fct_dv360_lineitem",    // backbone -- the only table with Partner,
                           // Campaign, Invalid_Clicks, TrueView,
                           // Total_Conversions and Revenue_USD
  "fct_dv360_creative",
  "fct_dv360_inventory",
  "fct_dv360_placement",
  "fct_dv360_geo",
  "fct_dv360_timeofday",
  "fct_dv360_reach",       // NON-ADDITIVE
  "fct_dv360_floodlight",  // 15 rows over 10 days. The only DV360 table
                           // that did NOT grow -- it is simply sparse.
  "fct_dv360_youtube",     // deliberately not staged: a second source of
                           // truth for TrueView views. Declared so the
                           // graph records that we know it is there.

  // NEW on 2026-10-13, no equivalent in the old set. Audience Category by
  // line item and day, 529,923 rows. IMPRESSIONS ONLY -- no spend, no
  // clicks -- so it answers "who saw this" and never "what did it cost".
  // Note Impressions is FLOAT64 here and INT64 in fct_dv360_lineitem.
  "fct_dv360_audience",

  // NEW on 2026-10-22. Line item x Targeted Location x Bid Strategy Type
  // x day -- the sixth branch of stg_dv360_breakdown. 1,881 rows, asked
  // for 30 days, landed with the same two-day lag as every other Keboola
  // feed.
  //
  // Note the lowercase l in Targeted_location: the only column in the
  // DV360 set that does not follow Title_Case. Spelled as the source
  // spells it, deliberately -- renaming it here would hide the fact that
  // a future extract may "fix" the casing and break the ref.
  "fct_dv360_targetedbid",
];

// ---------------------------------------------------------------------
// keboola_cm360 — Keboola extraction for CM360
//
// CM360 lived in kebooladv until 2026-10-12, when those tables were
// DROPPED and recreated here. The move was not cosmetic: the extract had
// been frozen since 2026-09-28 in the old location and is fresh daily in
// this one, with roughly seven times the rows.
//
//   cm360_hourly         11,804 -> 82,413
//   cm360_reach             136 -> 439
//   cm360_floodlights        23 -> 2,026
//   cm360_united              — -> 235,821   (new)
//   cm360_standard_table     42 -> gone
// ---------------------------------------------------------------------
const CM360_TABLES = [
  "cm360_hourly",      // backbone. Column names unchanged from the old
                       // location, so staging needed only a repoint.
  "cm360_united",      // NEW and the largest. Daily rather than hourly, and
                       // the first CM360 source to carry NAMES — advertiser,
                       // campaign, site, placement, ad, creative — plus
                       // country and city. Replaces the seed_site lookup and
                       // the advertiser-name bridge.
  "cm360_floodlightsv2", // replaces cm360_standard_table as the conversion
                       // source, and is far richer: activity and activity
                       // group, revenue, and the view-through / click-through
                       // split that the old table collapsed into one number.
                       //
                       // RENAMED upstream on 2026-10-17: cm360_floodlights
                       // was dropped and cm360_floodlightsv2 created in its
                       // place, with no notice. Three days of runs failed at
                       // stg_cm360_floodlight -- "Table ... was not found" --
                       // and every downstream object, including the core
                       // cross-channel fact, was skipped. v2 carries all 29
                       // columns v1 did, plus placementStartDate and
                       // placementEndDate; it dropped impressions_str, which
                       // was never read. Duplication fell from 40% to 1.3%.
  "cm360_reach",       // NON-ADDITIVE unique reach. SUPERSEDED 2026-11-11 by
                       // cm360_reachv2 below; nothing reads it any more.
                       // Kept declared for one week as a fallback, then
                       // remove this line and drop the table.

  // THE CAMPAIGN-LEVEL REPORT, DONE PROPERLY. Arrived 2026-11-11 and
  // replaces cm360_reach for every purpose. Measured the day it landed:
  //
  //                        cm360_reachv2   cm360_reach
  //   rows                        3,981        12,547
  //   real keys                   3,981         2,756
  //   copies per key               1.00          4.55
  //   days                           60            43
  //   campaigns                     174           156
  //   advertisers                    88            83
  //
  // IT IS THE FIRST CM360 TABLE WITH NO DUPLICATION AT ALL, which is why
  // stg_cm360_reach no longer de-duplicates. The old largest-wins QUALIFY
  // was not free: picking the maximum impressions across up to seven
  // snapshots OVERSTATED them. Reconciled over the overlapping 43 days,
  // every difference ran one way -- v2 is 52,032 impressions lower on
  // 199.3M, 0.03%, and 24 clicks lower on 613,936.
  //
  // CROSS-VALIDATED AGAINST cm360_basic, a different extraction, over the
  // full 60 days: 1,130,840 clicks on both sides, to the unit, and
  // 284,349,327 impressions against 284,349,452 -- 125 apart in 284M.
  //
  // STILL DELIVERS date AS STRING and clicks AS FLOAT (no fractional
  // values, so the cast is safe), and carries no extracted_at. Asked for.
  "cm360_reachv2",

  // THE CLICK-ACCURATE ONE, and it sat here unread until 2026-11-11.
  // Campaign x site x creative x day. Three dimensions where cm360_united
  // has six, and CM360 drops a click it cannot match on every dimension a
  // report requests -- so the shorter list keeps the clicks. Measured over
  // 2026-11-03..09 against cm360_reach, which matches the CM360 interface:
  //
  //   cm360_reach    campaign                        140,790   100%
  //   cm360_basic    campaign x site x creative      140,779   99.99%
  //   cm360_united   + placement, ad, country, city   57,149   40.6%
  //
  // cm360_united also reports 60.7M impressions for those campaign-days
  // against the campaign report's 42.8M -- 42% more, from splitting rows the
  // campaign total counts once. So united is for country and city, and this
  // is for everything about a site or a creative.
  //
  // ALONE AMONG THE CM360 TABLES IT DOES NOT RE-APPEND ITS WINDOW. 45,729
  // rows for 45,729 keys across all 60 days on 2026-11-11, while cm360_reach
  // carries 4.55 copies of every row and cm360_hourly 1.14. It is also the
  // only one delivering `date` as a DATE rather than a string.
  "cm360_basic",
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
  // DAILY SINCE 2026-10-12. It arrived as ROLLING 7-DAY WINDOWS -- no `date`
  // column, every row spanning date_start..date_stop = 6 days, a new window
  // every day, so an unfiltered SUM(spend) returned 28.3M against a true
  // ~3.8M. Weld switched it to time_increment: 1 and the columns changed
  // with it. That is the "can change without notice" above, already spent.
  //
  // ITS GRAIN IS ONE COLUMN FINER THAN IT LOOKS: date + campaign + age +
  // gender + ad_format_asset, a Meta asset id delivered as a FLOAT. Staging
  // keyed without the asset id until 2026-11-09 and its de-duplication was
  // therefore discarding real rows -- 694,133 impressions in October alone.
  //
  // IT ALSO CARRIES reach, frequency AND inline_link_clicks. Three files in
  // this repo described those as absent, so nobody read them for five weeks.
  // They are read now. If a further breakdown column ever appears, the same
  // silent loss happens again; assert_meta_age_gender_grain reconciles
  // staging volume against this table to catch exactly that.
  "age_gender",

  "demographics_age_and_gender",             // no ad_id
  "demographics_age_and_gender_actions",     // conversions at age x gender.
                                             // The ONLY way to get post
                                             // engagements and leads at this
                                             // grain. Also has no ad_id.
  // AD x PUBLISHER PLATFORM x PLATFORM POSITION x DEVICE, daily. Not Weld
  // at all -- Keboola writes it straight into facebook_ads_weld, so this
  // dataset now holds one table from a different vendor. Declared where it
  // physically sits.
  //
  // THE ONLY SOURCE OF platform_position IN THE WAREHOUSE. feed, reels,
  // stories, right-hand column, marketplace, search. The five Weld
  // breakdowns stop at publisher_platform and cannot separate a reels
  // impression from a feed one.
  //
  // IT HAS NO _weld_synced. De-duplication is largest-wins, not
  // newest-wins -- see stg_meta_placement.
  //
  // THE _v3_insights SUFFIX IS LOAD-BEARING. Its predecessor,
  // platform_position_device_keboola, is still in the dataset and still
  // being written. That one also requested `actions`, which the extractor
  // flattens into child rows that destroy the parent metrics row, so it
  // holds only the placement rows that had zero clicks: 0.7% of delivery,
  // with correct values. It is NOT declared, must not be staged, and the
  // nearly-identical name is the whole reason this comment is this long.
  "platform_position_device_keboola_v3_insights",

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
// keboola_tiktok — Keboola extraction for TikTok. ONE table.
//
// Arrived 2026-10-30, after Weld could not add video metrics to its
// breakdown reports. It is the SAME data Weld already delivers in
// tiktok_ads.campaign_platform_report -- checked on all eight
// overlapping days, 2026-10-21 to 10-28: every daily impression total
// identical, every spend total equal to the seventh decimal
// (5894.550000 vs 5894.549989). 3,017 of 3,018 campaign x platform x
// day pairs identical, nothing present only in Keboola.
//
// So it is NOT a second source of truth for spend, and nothing reads
// delivery from it. It is joined ONLY for the three video columns Weld
// does not carry.
//
// Two things make it the junior partner despite being richer:
//   * 8 days of history against Weld's 88
//   * two days of lag against Weld's one
// Weld therefore stays the base of the platform breakdown and this
// table LEFT JOINs onto it. See stg_tiktok_breakdown.
//
// The name is misspelled at source -- titktok, with an extra t. Spelled
// here as the source spells it. If Keboola ever corrects it this ref
// breaks loudly, which is the right failure: a silent rename cost three
// days when cm360_floodlights became cm360_floodlightsv2.
// ---------------------------------------------------------------------
const KEBOOLA_TIKTOK_TABLES = [
  "titktok_platform",  // ad x platform x day. ANDROID, IPHONE, IPAD,
                       // WAP, UNKNOWN. Carries video_watched_2s,
                       // video_watched_6s and video_play_actions, and
                       // does NOT carry conversion or result.

  // CAMPAIGN LIFETIME REACH. Declared 2026-11-10, five weeks after it
  // appeared. The header above said "ONE table" and nobody looked again.
  //
  // Three columns: ex_advertiser_id, campaign_id, reach. 2,154 campaigns
  // across 81 accounts. It is the ONLY campaign-level reach in the
  // warehouse for any channel -- Meta's equivalent, campaign_insight,
  // has been frozen since 2026-09-22 and covered 2 accounts when it ran.
  //
  // CUMULATIVE SINCE CAMPAIGN START, and there is no date column. Each
  // run overwrites the previous value, so the table answers "how many
  // people has this campaign reached so far" and nothing else. Two
  // consequences, both load-bearing:
  //
  //   * A finished campaign's final figure is lost the moment the
  //     campaign leaves the extract. That is exactly the number anyone
  //     reporting on a closed campaign wants.
  //   * "Reach in October" cannot be derived. Subtracting the value on
  //     1 October from the value on 31 October does NOT give the people
  //     reached in between -- anyone counted in both windows cancels
  //     out. A date range needs its own request to TikTok.
  //
  // fct_tiktok_campaign_reach_lifetime snapshots it daily so the first
  // problem stops getting worse. The second has no fix on our side.
  //
  // Validated 2026-11-10 against campaign_daily_report: 220 campaigns
  // matched, mean frequency 7.16, and ZERO campaigns where reach
  // exceeded impressions -- which is the one thing that would prove the
  // figure wrong.
  "tiktok_campaign_reach_lifetime",
];

// ---------------------------------------------------------------------
// keboola_teads — Keboola extraction for Teads. TWO tables.
//
// Arrived 2026-10-30. Teads is the sixth channel and the first one that
// is NOT a self-service platform: everything is bought as a managed
// insertion order, so there is no account hierarchy to model. One flat
// table carries seat, advertiser, campaign, line item and creative
// names together, which is why this channel needs no dimension tables.
//
// THE ONE THING THAT MAKES THIS SOURCE DIFFERENT: extracted_at.
// Every other Keboola extract in this project APPENDS a fresh extract
// beside the previous one and gives you no way to tell which read is
// newer, so staging has to de-duplicate on "largest wins" and hope the
// counter only ever goes up. These two tables carry the load timestamp,
// so they are de-duplicated on "newest wins", which is actually
// correct -- a restated day that goes DOWN is handled properly here and
// nowhere else.
//
// WHETHER THESE TABLES APPEND IS UNSETTLED, and the two measurements
// disagree:
//   2026-10-29  teads_uv_daily  4,880 rows / 2,972 grain keys / 3
//               extracted_at values -- 39% inflation.
//   2026-10-30  teads_uv_daily  2,851 rows / 2,851 grain keys / 1
//               extracted_at.   teads_daily 3,175 / 3,175 / 1.
// Both tables are now exactly clean. Either the load was switched to
// replace between those two days, or the three extractions on the 29th
// were a backfill that has since been collapsed. Nobody told us which.
//
// Staging de-duplicates anyway. The repo's standing rule is NOT to
// de-duplicate pre-emptively -- an arbitrary tiebreak on a clean table
// silently deletes real rows, which is why stg_tiktok_campaign_daily
// has no QUALIFY. That rule turns on the word ARBITRARY. Here the
// tiebreak is extracted_at, a real load timestamp, so on a clean table
// it is provably a no-op: one row per key, one timestamp, nothing to
// choose between. It costs nothing and it covers the 29th happening
// again. See stg_teads_daily and stg_teads_uv.
// ---------------------------------------------------------------------
const TEADS_TABLES = [
  "teads_daily",     // day x seat x advertiser x campaign x line item x
                     // creative. Delivery, money and Moat viewability.
                     // THE delivery table.
  "teads_uv_daily",  // the same grain plus line_item_billable_event,
                     // carrying unique_viewers. NON-ADDITIVE. Its
                     // impressions / video_starts / video_completes
                     // duplicate teads_daily and are deliberately not
                     // staged -- see stg_teads_uv.
];

// ---------------------------------------------------------------------
// keboola_taboola — Keboola extraction for Taboola. TWO tables.
//
// Arrived 2026-11-05. The smallest source in the project: 289 delivery
// rows over 44 days, 9 delivering campaigns, ONE advertiser
// (tdg-e-onromania-sc, E.ON Romania). Native advertising, bought CPC.
//
// THREE THINGS ARE SPECIFIC TO IT:
//
//   * IT BILLS IN USD. Every other channel here is EUR, or converts
//     from RON through MonthlyExchangeRate. Taboola is why that table
//     gained an ExchangeRateUSD column on 2026-11-05, and why
//     stg_fx_monthly now unpivots instead of hard-coding RON.
//
//   * `date` is a STRING carrying a time part -- '2026-11-04 00:00:00.0'.
//     SAFE_CAST(date AS DATE) returns NULL on every row. It needs
//     SUBSTR(date, 1, 10). Checked 2026-11-05: 289 of 289 fail the
//     direct cast and 0 of 289 fail the substring.
//
//   * NO CONVERSIONS, although all 16 campaigns bid MAX_CONVERSIONS.
//     The feed carries clicks, impressions, visible impressions and
//     spend, and nothing attributed. Worth asking Keboola for, since
//     the campaigns are explicitly optimising for something we cannot
//     see.
//
// No extracted_at, so there is no load timestamp to de-duplicate on.
// Verified clean 2026-11-05: 289 rows for 289 distinct (date, campaign)
// keys. Staging therefore does NOT de-duplicate -- an arbitrary
// tiebreak on a clean table deletes real rows, which is the same
// reasoning as stg_tiktok_campaign_daily. The uniqueKey assertion on
// fct_taboola_campaign_daily is what watches that assumption.
// ---------------------------------------------------------------------
const TABOOLA_TABLES = [
  "taboola_campaign_day",  // date x campaign. Delivery, spend, currency
                           // and visible_impressions (a real viewability
                           // denominator, like Teads).
  "taboola_campaigns",     // campaign entity: advertiser_id, pricing
                           // model, bid strategy, daily cap. 16 rows,
                           // 9 of which have delivery.
];

// ---------------------------------------------------------------------
// keboola_adform — Keboola extraction for Adform. ONE table.
//
// Arrived 2026-11-05. 1,600 rows over 47 days, one client
// (HORNBACH RO), four campaigns, 24 line items, EUR. The grain is
// date x campaign x line item.
//
// Better shaped than most sources here: `date` is a real DATE, the
// currency is EUR so nothing needs converting, and it carries
// unique_reach, which only DV360, CM360 and Teads otherwise do.
//
// IT DUPLICATES INSIDE A RECENT WINDOW. 1,600 rows for 803 distinct
// grain keys. 725 of the extra rows are byte-identical and fall to
// SELECT DISTINCT; the remaining 72 keys carry rows that DIFFER, all of
// them between 2026-10-30 and 11-05, and 66 of those 72 have one row
// exactly DOUBLE the other. See stg_adform_daily for which row is kept
// and why.
//
// adCreativeType is a single value, 'Pixel Tag', on all 1,600 rows. It
// is staged but is not a usable dimension yet.
// ---------------------------------------------------------------------
const ADFORM_TABLES = [
  "adform_reports_combined",  // date x campaign x line item. Delivery,
                              // cost and three reach-shaped columns.
];

// ---------------------------------------------------------------------
// keboola_chatgptads — Keboola extraction for ChatGPT Ads. THREE tables.
//
// Arrived 2026-11-06. 16 accounts, 7 of them delivering, 2026-10-07 to
// 11-05. Clean: 448 rows for 448 (date, ad) keys and 206 for 206
// (date, campaign, country) keys.
//
// MIXED CURRENCIES, AND THE SOURCE STATES THEM. 12 accounts bill in RON
// and 4 in EUR. ad_accounts.currency_code carries it per account and is
// fully populated -- checked 2026-11-06, 16 of 16.
//
// That column is load-bearing and must not be replaced by a lookup
// written out by hand. TWO DIFFERENT ACCOUNTS ARE BOTH NAMED "United
// Media Services":
//   adacct_6a8c2610ec2c81a29fc6963af110f441   EUR
//   adacct_6abb85502ba48195b968b4fe63044044   RON
// and two more differ only in capitalisation, "UNITED MEDIA SERVICES
// SRL" (EUR) against "United Media Services SRL" (RON). A name-keyed
// map cannot represent that; an id-keyed one would just be a copy of a
// column the source already provides, free to drift from it.
//
// THE TWO INSIGHT TABLES ARE THE SAME MONEY. insights_ad_daily totals
// 14,324.73 and insights_campaign_country_daily 14,324.69 over the same
// window -- four cents apart on different roll-ups. Never union them;
// the country table is the ad table split by country, nothing more.
//
// ctr, cpc and cpm arrive pre-computed on both tables. They are staged
// with an src_ prefix, audit only -- a stored ratio is correct solely
// at the grain it was computed at, and the reporting layer recomputes.
// ---------------------------------------------------------------------
const CHATGPTADS_TABLES = [
  "ad_accounts",                      // 16 rows. THE source of currency.
  "insights_ad_daily",                // date x ad. The delivery backbone.
  "insights_campaign_country_daily",  // the same money by country.
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

  // PHASE 2c — THE NAME IS A LIE. "youtube_ads" is a campaign x day x
  // ad_network_type table covering ALL SEVEN channel types: SEARCH,
  // PERFORMANCE_MAX, DEMAND_GEN, VIDEO, DISPLAY, MULTI_CHANNEL, SHOPPING.
  // YouTube is merely where the video columns stop being NULL.
  //
  // Its cost_micros is an EXACT DUPLICATE of campaign_stats. Verified
  // 2026-10-02 over September: 23,575 campaign-days, zero differing, both
  // totals 5,240,904.57 to the cent. stg_gads_campaign_network_daily
  // therefore does not select a spend column at all — a column that is not
  // there cannot be summed by accident.
  //
  // It is read for SEVEN columns that exist nowhere else in the feed:
  // the four video quartile rates, video_trueview_views, engagements and
  // all_conversions(+_value). Checked 2026-10-05: the only video or
  // engagement column in campaign_stats is video_views.
  //
  // It is NOT a replacement for campaign_stats, which has nine more days of
  // history (107 vs 98) and carries device, and NOT for anything at ad
  // group, ad, keyword or audience level. The right upstream fix is to add
  // these seven columns to the campaign_stats pull and delete this table.
  "youtube_ads",

  // PHASE 3 — search intent. Both fresh daily and both were sitting
  // unread until the 2026-10-12 source audit; neither is a duplicate of
  // anything already staged.
  "search_term_stats", // 5.8M rows. What people ACTUALLY typed, which
                       // keyword matched it, and whether it is already
                       // added or negated. All metric columns arrive as
                       // FLOAT64, including cost_micros and impressions.
  "keyword_stats",     // 969k rows. Keyword performance BY DAY. The
                       // history dim_gads_keyword has never had — that
                       // table is a Quality Score snapshot with no date.
                       // Every id column is a STRING here, unlike every
                       // other google_ads table.

  // PHASE 3b — geography and ad-group bidding. Both found unread in the
  // 2026-10-12 source audit.
  "ad_group_country_stats",    // 404k rows. Google Ads has NO geography in
                               // this project without it. Carries
                               // location_type, which separates where the
                               // user WAS from what they were interested in.
  "geo_target",                // 274k rows. The name lookup for
                               // country_criterion_id. Without it geography
                               // is a column of numeric ids.
  "ad_group_bidding_strategy", // 63k rows. Ad-group bid overrides and the
                               // EFFECTIVE target, which resolves whether a
                               // target came from the ad group or was
                               // inherited from the campaign.
];

// ---------------------------------------------------------------------
// FINAL_TABLES — hand-built reference data that predates this project
// ---------------------------------------------------------------------
const FINAL_TABLES = [
  "MonthlyExchangeRate",  // Date (first of month) + ExchangeRate. No
                          // currency column: it is implicitly RON per
                          // 1 EUR. Covers 2026-04 onwards.

  // THE ONLY PLACE CM360 MEDIA COST EXISTS, and it is not CM360's own
  // figure. The legacy pipeline joins the CM360 delivery report to the
  // booked rate from the media plan -- flight_booked_rate -- and the
  // product is media_cost, in EUR.
  //
  // DO NOT CONFUSE IT WITH keboola_cm360 mediaCost. Two columns, nearly
  // the same name, an order of magnitude apart:
  //
  //   FINAL_TABLES.CM360.media_cost        media       CPM 3.27 EUR
  //   keboola_cm360.cm360_basic.mediaCost  serving fee CPM 0.20 EUR
  //
  // VALIDATED 2026-11-11 against the AOS dashboard, campaign
  // UMS_Novo Nordisk_Menopauza, 1 Oct - 11 Nov: 13 sites against 13,
  // 12,842 clicks against 12,842 to the unit, 13,694.91 EUR against
  // 13,694.34. Per site it agrees to the cent.
  //
  // GRAIN IS date + campaign + site + creative, the same as cm360_basic,
  // but it carries NO campaign_id and NO site_id -- only creative_id and
  // advertiser_id. 36.3M rows, 433 campaigns, 2025-12-01 onwards, no null
  // costs, and it is still written daily by the old pipeline.
  //
  // IT COVERS DIRECT BUYS ONLY, which is correct rather than a gap.
  // Measured over October: 118 campaigns carry cost, and the 24 that do
  // not are all BidManager -- programmatic bought in DV360, whose cost
  // lives there. One campaign is genuinely missing, HelpNet White Label.
  //
  // calculated_media_cost IS NULL ON EVERY ROW. The column exists and is
  // not filled. media_cost is the one to read.
  "CM360",
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

KEBOOLA_TIKTOK_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.tiktok_keboola,
    name: name,
  });
});

TEADS_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.teads,
    name: name,
  });
});

TABOOLA_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.taboola,
    name: name,
  });
});

ADFORM_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.adform,
    name: name,
  });
});

CHATGPTADS_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.chatgptads,
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

CM360_TABLES.forEach(name => {
  declare({
    database: constants.RAW_PROJECT,
    schema: constants.DATASETS.cm360,
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
