// Calculated metric definitions — the single place CPM, CTR, CPA and the
// rate metrics are defined. Every reporting view calls these, so changing
// a definition here changes every dashboard at once.
//
// Usage in .sqlx:
//   ${metrics.cpm("f.spend", "f.impressions")} AS cpm
//
// Rule: a ratio is NEVER stored in a mart. It is computed in the
// reporting view, over the sums, so it stays correct at every level of
// aggregation Looker Studio rolls it up to.

function cpm(spend, impressions) {
  return `SAFE_DIVIDE(${spend}, ${impressions}) * 1000`;
}

function ctr(clicks, impressions) {
  return `SAFE_DIVIDE(${clicks}, ${impressions})`;
}

function interactionRate(interactions, impressions) {
  return `SAFE_DIVIDE(${interactions}, ${impressions})`;
}

// Completion against whatever denominator the source can give.
//
// DV360, CM360, TikTok and Google Ads deliver no video-start count, so
// their views pass impressions and the result is a PROXY — completions
// per impression, which is not the industry VTR.
//
// Teads does deliver video_starts, so teads/v_daily passes that and
// gets the real thing. The two are NOT comparable with each other.
// Read the column description on the view before putting them on the
// same chart.
function completionRate(completeViews, denominator) {
  return `SAFE_DIVIDE(${completeViews}, ${denominator})`;
}

function viewRate(views, impressions) {
  return `SAFE_DIVIDE(${views}, ${impressions})`;
}

function cpa(spend, conversions) {
  return `SAFE_DIVIDE(${spend}, NULLIF(${conversions}, 0))`;
}

function cpc(spend, clicks) {
  return `SAFE_DIVIDE(${spend}, NULLIF(${clicks}, 0))`;
}

// Google Ads' "Average cost": cost per INTERACTION, not per click.
//
// It is not a synonym for cpc, and the gap is the whole point of having
// both. On a Search campaign an interaction IS a click and the two agree.
// On Video an interaction is a view, on Discovery an engagement, on Call
// campaigns a phone call -- so average_cost there is cost per view or per
// call, while cpc stays cost per click and reads very differently.
//
// stg_gads_campaign_daily carries src_interaction_event_types, which says
// what the interactions column counted for that campaign type. Read it
// before comparing average_cost across channel types.
function averageCost(spend, interactions) {
  return `SAFE_DIVIDE(${spend}, NULLIF(${interactions}, 0))`;
}

// Engagements per impression.
//
// MEASURED 2026-11-25 over 1-25 November, and it does not behave the way
// the column description on stg_gads_campaign_network_daily implies:
//
//   VIDEO           31,354,093 engagements / 98,995,697 impressions  0.3167
//   DEMAND_GEN       1,844,754 / 27,796,109                          0.0664
//   MULTI_CHANNEL      133,805 /  1,411,861                          0.0948
//   DISPLAY             17,949 / 23,569,943                          0.0008
//   SEARCH, SHOPPING         0                                            -
//
// So VIDEO carries 94% of all engagements, not Demand Gen. On Video an
// engagement is effectively the same event as an interaction -- 31.35M
// against 31.39M interactions on the same days -- while on Display it is
// a rounding error. Averaging this across advertising_channel_type mixes
// a video view with a banner expand.
function engagementRate(engagements, impressions) {
  return `SAFE_DIVIDE(${engagements}, ${impressions})`;
}

// Viewability, against whatever denominator the source can give.
//
// CM360 passes impressions, because the Keboola report does not deliver
// Measurable Impressions. That is NOT CM360's "Active View: % Viewable
// Impressions" and it reads LOWER than the CM360 UI.
//
// Teads passes measurable impressions, because Moat delivers them, so
// teads/v_daily carries the real viewability rate. Higher than the CM360
// column of the same name, and not comparable with it.
function viewableRate(viewableImpressions, denominator) {
  return `SAFE_DIVIDE(${viewableImpressions}, ${denominator})`;
}

// Impressions per reached person. Only valid where reach was
// de-duplicated at the same grain as the impressions.
function frequency(impressions, reach) {
  return `SAFE_DIVIDE(${impressions}, NULLIF(${reach}, 0))`;
}

function roas(conversionValue, spend) {
  return `SAFE_DIVIDE(${conversionValue}, NULLIF(${spend}, 0))`;
}

// DV360 delivers dates as STRING 'YYYY/MM/DD'.
function parseSlashDate(col) {
  return `SAFE.PARSE_DATE('%Y/%m/%d', ${col})`;
}

// CM360 delivers dates as STRING in a format Keboola has changed before.
// COALESCE over the three plausible layouts instead of guessing one.
function parseCm360Date(col) {
  return `COALESCE(
    SAFE.PARSE_DATE('%Y-%m-%d', ${col}),
    SAFE.PARSE_DATE('%Y/%m/%d', ${col}),
    SAFE.PARSE_DATE('%d/%m/%Y', ${col})
  )`;
}

// Google Ads reports money in micros — millionths of the account
// currency. cost_micros = 1234560 means 1.23456 units.
function micros(col) {
  return `SAFE_DIVIDE(${col}, 1000000)`;
}

// TikTok delivers stat_time_day / stat_time_hour as STRING shaped
// 'YYYY-MM-DD HH:MM:SS'. Taking the first 10 characters is deliberate:
// it works whether or not the time part is present, and needs no regex,
// so there are no backslashes to be eaten by .sqlx compilation.
function parseTiktokDate(col) {
  return `SAFE.PARSE_DATE('%Y-%m-%d', SUBSTR(${col}, 1, 10))`;
}

// Characters 12-13 of 'YYYY-MM-DD HH:MM:SS' are the hour, 00-23.
function parseTiktokHour(col) {
  return `SAFE_CAST(SUBSTR(${col}, 12, 2) AS INT64)`;
}

module.exports = {
  cpm, ctr, interactionRate, completionRate, viewRate, cpa, cpc,
  viewableRate, frequency, roas,
  averageCost, engagementRate,
  parseSlashDate, parseCm360Date, parseTiktokDate, parseTiktokHour,
  micros,
};
