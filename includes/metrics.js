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

// Proxy: no video-starts column is delivered by any of the three
// extractors, so completion is measured against impressions.
function completionRate(completeViews, impressions) {
  return `SAFE_DIVIDE(${completeViews}, ${impressions})`;
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

// CM360 only. NOT CM360's "Active View: % Viewable Impressions" — the
// real metric divides by Measurable Impressions, which the Keboola
// report does not deliver. This reads LOWER than the CM360 UI.
function viewableRate(viewableImpressions, impressions) {
  return `SAFE_DIVIDE(${viewableImpressions}, ${impressions})`;
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
  parseSlashDate, parseCm360Date, parseTiktokDate, parseTiktokHour,
};
