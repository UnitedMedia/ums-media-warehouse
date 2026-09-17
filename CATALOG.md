# Data catalogue — what to query and what is in it

Every table and view in the UMS media warehouse, what it is for, and what will
catch you out. If you are building a dashboard or answering a question, start
at "Pick a table" and stop reading once you have your answer.

For how the project is built and maintained, see [README.md](README.md).

Project: `ums-digital-core-automation`. Everything is in the EU region.

---

## The one rule

**Connect Looker Studio to a `*_reporting` view. Never to a `_marts` table,
never to a `_staging` view.**

The marts hold the numbers but no labels and no calculated metrics — they
store impressions and spend, never CPM or CTR. The reporting views add the
names, the hierarchy and every ratio. A ratio computed in the view stays
correct no matter how Looker rolls it up; a ratio stored in a table does not.

---

## Pick a table

| I want to know… | Use |
|---|---|
| DV360 spend, impressions, clicks, conversions | `dv360_reporting.v_daily` |
| Which DV360 creative performed best | `dv360_reporting.v_creative_daily` |
| Which sites/apps DV360 ran on | `dv360_reporting.v_placement_daily` |
| DV360 by device, exchange, environment | `dv360_reporting.v_inventory_daily` |
| DV360 by day of week / hour | `dv360_reporting.v_timeofday_daily` |
| DV360 unique reach | `dv360_reporting.v_reach_daily` |
| CM360 impressions, clicks, viewability, serving cost | `cm360_reporting.v_daily` |
| CM360 by hour | `cm360_reporting.v_hourly` |
| CM360 conversions or reach | `cm360_reporting.v_campaign_daily` |
| Meta spend, conversions, ROAS, cost per anything | `meta_reporting.v_ad_daily` |
| Meta by age, gender, country, platform, device | `meta_reporting.v_breakdown_daily` |
| TikTok spend — the complete total | `tiktok_reporting.v_campaign_daily` |
| TikTok by ad, creative, video performance | `tiktok_reporting.v_daily` |
| TikTok by hour | `tiktok_reporting.v_hourly` |
| TikTok by age, gender, country, language, platform | `tiktok_reporting.v_breakdown_daily` |
| All three channels in one chart | `reporting.v_ad_performance_daily` |
| What is broken or unmapped right now | `reporting.v_data_gaps` |
| How a metric is defined | `dv360_reporting.v_metric_catalog`, `cm360_reporting.v_metric_catalog` |
| Whether we can split by some dimension | `dv360_reporting.v_dimension_coverage` |

### Where the money is

| Channel | Column | In which view | What it actually is |
|---|---|---|---|
| DV360 | `spend` | `dv360_reporting.v_daily` | Revenue in **advertiser currency**, sell-side |
| DV360 | `spend_usd` | `dv360_reporting.v_daily` | Same, in USD. Use for cross-currency totals |
| CM360 | `media_cost` | `cm360_reporting.v_daily` | See the warning below — probably a serving fee |
| Meta | `spend` | `meta_reporting.v_ad_daily` | Account currency |
| TikTok | `spend` | `tiktok_reporting.v_campaign_daily` | **Complete.** Advertiser currency |
| TikTok | `spend` | `tiktok_reporting.v_daily` | Ad level — only ~98.6% of the above |

### Where the impressions are

Every fact in every channel carries `impressions`. The ones to trust for a
**total** are the backbone views — `dv360_reporting.v_daily`,
`cm360_reporting.v_daily`, `meta_reporting.v_ad_daily`. Every other view is a
breakdown of those same impressions along one dimension, so you can compare
within it but must never add two breakdowns together.

---

## Read this before you total anything

**TikTok and Meta are live; DV360 and CM360 are not.**
TikTok runs through today and updates daily, 46 days of history from 3 August.
Meta is current. The other two stopped in August — see below.

**DV360 and CM360 data stops in August 2026.** DV360's last day is 2026-08-25,
CM360's is 2026-08-31. The Keboola extractions stopped and had not been
restarted as of 2026-09-16. Any chart covering September will show a cliff
that is not a performance story. Meta is current.

**CM360 `media_cost` is not comparable with DV360 or Meta spend.** For the same
period CM360 totals 2,538 against DV360's 68,916 and Meta's 36,418. That is the
shape of an ad-serving fee, not media spend — and if CM360 is serving
impressions bought in DV360, adding the two both double-counts the delivery and
mislabels the money. `reporting.v_ad_performance_daily` will happily sum them.
Do not build a cross-channel spend figure until someone confirms what CM360's
cost column represents.

**Reach is never additive.** `unique_reach` (DV360) and `total_reach` (CM360)
are de-duplicated by the platform at one specific grain. A month's reach is not
the sum of its days. In Looker Studio set those fields' aggregation to **MAX**,
keep the reach views as their own data source, and never blend them with a
delivery source — the blend fans reach rows out against delivery rows and both
sides come out wrong.

**Currency.** DV360 spend is in advertiser currency, Meta in account currency,
CM360 has no currency column at all. Break out or filter by currency before
summing across advertisers.

**Conversions mean different things per channel.** DV360 counts
`Total_Conversions`, CM360 counts Floodlight totals at campaign level, Meta
counts "Results" resolved from each ad set's optimization goal. The
cross-channel fact carries a `conversions_definition` column on every row for
exactly this reason. Show it, or do not show conversions.

---

## DV360

Source: Keboola → `kebooladv.fct_dv360_*`.

### Reporting views — `dv360_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | line item × day | **The main one.** Spend, impressions, clicks, invalid clicks, interactions, complete views, TrueView views, total conversions, plus CPM, CTR, interaction rate, completion rate, TrueView view rate and CPA. Carries the full hierarchy: partner → advertiser → campaign → insertion order → line item. |
| `v_creative_daily` | creative × day | Comparing creatives. Adds creative name, asset, size, ad type. |
| `v_placement_daily` | app/URL × day | Where ads ran. Impressions, clicks, spend, CPM, CTR only — the source carries no video or conversions at this grain. |
| `v_inventory_daily` | inventory context × day | Media type, device type, environment, exchange, inventory source, channel, ad position. These dimensions exist nowhere else. |
| `v_geo_daily` | country × day | Country only. |
| `v_timeofday_daily` | weekday × hour × day | Dayparting. Use `day_of_week_sort` to order weekdays, or Looker sorts them alphabetically. |
| `v_reach_daily` | line item × day | Unique reach, on its own, deliberately. |
| `v_metric_catalog` | — | One row per metric with its formula. |
| `v_dimension_coverage` | — | Answers "can we split by X?" for 39 dimensions. |

**Caveats that matter:**

- `v_creative_daily` covers about **85% of spend**. DV360 drops impressions it
  cannot attribute to a named creative. Compare creatives with it; never total
  money with it.
- `v_inventory_daily` is backed by **one day** of source data.
- `v_geo_daily` has roughly **61 rows a month**. Directional at best.
- CPA in `v_daily` uses `Total_Conversions`. The breakdown views use post-click
  + post-view instead. The two will not tie, and that is the platform, not a bug.

### Marts — `dv360_marts`

Internal. Partitioned by `date`, clustered for filtering. No labels, no ratios.

| Table | Grain | Notes |
|---|---|---|
| `dim_dv360_line_item` | line item | The spine. Latest attributes plus `first_active_date` / `last_active_date` derived from delivery, and `flight_start_date` / `flight_end_date` from the hand-maintained seed. Also `lifetime_impressions` and `lifetime_spend`. |
| `fct_dv360_daily` | line item × day | **Source of truth for spend.** The only fact with `invalid_clicks`, `trueview_views`, `total_conversions` and `spend_usd`. |
| `fct_dv360_creative_daily` | creative × day | Partial spend coverage by design. |
| `fct_dv360_placement_daily` | app/URL × day | Highest volume table in the project. |
| `fct_dv360_inventory_daily` | inventory context × day | One day of data. |
| `fct_dv360_geo_daily` | country × day | Near-empty. |
| `fct_dv360_timeofday_daily` | weekday × hour × day | |
| `fct_dv360_reach_daily` | line item × day | Isolated on purpose — no metric from any other fact is in here. |

### Staging — `dv360_staging`

Views over the raw extracts. Date parsing, type fixes, renames. Nothing else.
Eight views, one per source table. `stg_dv360_geo` also repairs two extractor
defects: `Line_Item_ID` arrives as STRING there and FLOAT64 spend arrives as
STRING.

`stg_dv360_floodlight` exists but its source has **zero rows**, so it has no
mart and no view behind it. An empty table on a dashboard reads as "zero
conversions" rather than "no data", which is worse than nothing.

---

## CM360

Source: Keboola → `kebooladv.cm360_hourly`, `cm360_standard_table`, `cm360_reach`.

### Reporting views — `cm360_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | placement × ad × creative × day | **The main one.** Impressions, clicks, viewable impressions, video views, media cost, plus click rate, effective CPM, effective CPC, viewable rate and video view rate. Fully labelled with advertiser, campaign, site and landing page. |
| `v_hourly` | the same, plus hour | Its own chart and its own data source. Do not blend with `v_daily` — same money, finer grain. |
| `v_campaign_daily` | campaign × day | The only view with `total_conversions` and `total_reach`, plus `frequency`. |
| `v_metric_catalog` | — | Every CM360 metric with an `is_additive` flag. Worth reading once. |

**Caveats that matter:**

- **`viewable_rate` is not CM360's "% Viewable Impressions".** The real metric
  divides by Measurable Impressions, which the Keboola report does not deliver,
  so ours reads **lower than the CM360 UI**. Adding
  `activeViewMeasurableImpressions` to the report would close it.
- **Site names do not exist in the source.** They come from the hand-maintained
  `cm360_seeds.seed_site`. Unmapped sites appear as `site_<id>`.
- `placement_first_active_date` / `placement_last_active_date` are derived from
  **delivery**, not from booked flight dates — those are not in the report. Do
  not use them for pacing.
- `total_reach` is non-additive. Set it to MAX in Looker.
- Some campaigns appear in the standard report but never in the hourly report,
  so they have conversion totals but no placement, site or creative detail and
  no cost. Listed in `reporting.v_data_gaps`.

### Marts — `cm360_marts`

| Table | Grain | Notes |
|---|---|---|
| `fct_cm360_placement_hourly` | date × hour × placement × ad × creative | Base fact, largest table. **Requires a date filter on every query** — BigQuery rejects it otherwise. |
| `fct_cm360_placement_daily` | the same, rolled to date | What most dashboards should be built on. Adds `active_hours`. |
| `fct_cm360_campaign_daily` | campaign × day | Source of `total_conversions`. Its impressions and clicks are named `impressions_check` / `clicks_check` because they duplicate the hourly rollup — they are a checksum, not a second number to add. |
| `fct_cm360_reach_daily` | advertiser × campaign × day | Non-additive. Quarantined in its own table so nobody writes `SUM(total_reach)` next to `SUM(impressions)`. |
| `dim_cm360_advertiser` | advertiser | `is_name_missing` flags advertisers the reach bridge never named. |
| `dim_cm360_campaign` | campaign | Latest name wins if a campaign was renamed. |
| `dim_cm360_placement` | placement | Site name from the seed; `is_site_unmapped` flags the gaps. |
| `dim_cm360_ad_creative` | ad × creative | Most recently seen landing page wins. |

### Staging — `cm360_staging`

`stg_cm360_hourly` is the backbone. `stg_cm360_advertiser_bridge` exists because
`cm360_reach` is the **only** source table carrying `advertiserId` and the
advertiser name on the same row — without it, hourly data could never be
labelled with an advertiser. An advertiser absent from the reach report has no
name anywhere.

---

## Meta

Source: Weld → `facebook_ads_weld`. Weld lands about 137 tables; 14 are used.

### Reporting views — `meta_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_ad_daily`** | ad × day | **The main one, and it is wide.** Spend, impressions, clicks, link clicks, reach, frequency, CPM, CPC, CTR — plus every conversion metric as its own column, plus cost-per and ROAS for the common ones. Carries account, campaign, ad set and creative attributes including headline, primary text, CTA and thumbnail. |
| `v_breakdown_daily` | breakdown slice × day | Age, gender, country, publisher platform, device. |

**How the conversion columns work.** Meta reports conversions as a long list of
action types. `v_ad_daily` pivots 33 of them into columns:

- `n_<metric>` — the count, e.g. `n_purchases`, `n_leads`, `n_link_clicks`
- `val_<metric>` — the money value, e.g. `val_purchases`

plus `results`, `results_value`, `cost_per_result` and `results_roas`.
**"Results" is not a Meta field** — it resolves per ad set from the optimization
goal, via `meta_seeds.seed_result_type`. If an ad set's goal is not in that
seed, its results come back NULL and `assert_meta_results_coverage` goes red.

**Caveats that matter:**

- **Always filter `v_breakdown_daily` to exactly one `breakdown_type`.** All
  five breakdowns cover the *same* spend. Measured 2026-09-16: age_gender
  36,418.67 / country 36,418.50 / platform_device 36,418.33 /
  publisher_platform 36,417.95 / region 36,418.83 — against an ad-level total
  of 36,418.29. A scorecard with no `breakdown_type` filter reports 182,091,
  five times the real figure, and looks entirely plausible. One breakdown per
  chart, one per page, never a total across them. (The sub-cent variance is
  Meta's own per-breakdown rounding and privacy suppression.)
- **Never union `v_breakdown_daily` with `v_ad_daily`** either — that is the
  same spend a sixth time.
- Three of the five breakdowns (age/gender, platform+device, region) have **no
  `ad_id`**, so those rows carry no campaign or ad labels at all. Weld does not
  sync it. Sized in `reporting.v_data_gaps`.
- `reach` is de-duplicated by Meta at ad × day. Never sum it above that grain.
- Meta reports purchases under seven identical aliases. We keep one.
  `assert_meta_alias_leak` watches for the others getting through.
- `QUALITY_CALL` is currently mapped to `calls_connected_60s` as a **best guess**.
  If that is wrong, `cost_per_result` is wrong for that goal and nothing else.

### Marts — `meta_marts`

All three facts **require a date filter on every query**.

| Table | Grain | Notes |
|---|---|---|
| `fct_meta_ad_daily` | ad × day | Additive metrics only. Source of truth for Meta spend. |
| `fct_meta_ad_action_daily` | ad × day × metric | **Long, not wide.** A new conversion event adds rows, never columns. Aliases already excluded. |
| `fct_meta_breakdown_daily` | breakdown slice × day | |
| `dim_meta_ad` | ad | Account, campaign, ad set and creative flattened into one row. No dates, no metrics, so it cannot double-count. |

---

## TikTok

Source: Weld → `tiktok_ads`. **The only channel currently delivering fresh data
every day.**

Weld lands 41 tables and 21 of them carry identical metrics — the same money at
every hierarchy level, every time grain and every breakdown. Eleven are used.

### Reporting views — `tiktok_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_campaign_daily`** | campaign × day | **Any TikTok total.** Complete spend. Impressions, clicks, reach, conversions, results, purchases, video and engagement metrics, plus CPM/CTR/CPC/frequency/completion rate/ROAS. |
| **`v_daily`** | ad × day | **The detail.** Everything above plus ad name, format, text, CTA, landing page and the full video quartile curve. Covers ~98.6% of spend. |
| `v_hourly` | ad × hour | Dayparting. Its own data source — same money as `v_daily`. |
| `v_breakdown_daily` | slice × day | Age/gender, country, language, platform. |

**Caveats that matter:**

- **`v_daily` is ~1.4% short of `v_campaign_daily`.** TikTok cannot attribute
  every impression to a named ad. Compare ads with `v_daily`; total money with
  `v_campaign_daily`. `assert_tiktok_ad_coverage` watches the ratio.
- **`results` counts whatever the campaign optimised for** — its
  `objective_type`. Two campaigns with different objectives have incomparable
  results, so always show `objective_type` next to it.
- **Always filter `v_breakdown_daily` to one `breakdown_type`.** Four slices of
  the same spend; no filter means four times the real figure.
- **`platform` is campaign-level only**, so those breakdown rows have no `ad_id`.
- `reach` is non-additive. MAX in Looker, never SUM.
- `skan_conversions` is iOS SKAdNetwork — a separate, privacy-limited
  attribution path. Never add it to `conversions`.
- Video has a full quartile curve: `video_views_p25` / `p50` / `p75` / `p100`,
  plus `video_watched_2s` and `video_watched_6s`. `completion_rate` uses p100.

### Marts — `tiktok_marts`

| Table | Grain | Notes |
|---|---|---|
| `fct_tiktok_campaign_daily` | campaign × day | **Source of truth for TikTok spend.** What `core` reads. |
| `fct_tiktok_ad_daily` | ad × day | The detail, ~98.6% of spend. |
| `fct_tiktok_ad_hourly` | ad × hour | Dayparting. |
| `fct_tiktok_breakdown_daily` | slice × day | Four breakdowns normalised to one shape. |
| `dim_tiktok_campaign` | campaign | Campaign attributes plus advertiser and **currency**. |
| `dim_tiktok_ad` | ad | Ad, ad group, campaign and advertiser flattened. The only place the hierarchy exists — the ad report carries just `advertiser_id` and `ad_id`. |

### Staging — `tiktok_staging`

Eight views. `stg_tiktok_advertiser` is the only source of `currency` in the
entire TikTok feed. Staging deliberately does **not** de-duplicate — the grain
was verified 1:1 on 2026-09-17 and `assert_tiktok_grain` watches it.

### Not modelled

Every `*_weekly_report` and `*_monthly_report` (derivable with `DATE_TRUNC`),
the `ad_group_*` and `campaign_*` rollup reports, the 13 `ad_group_*` targeting
tables (one-to-many, they fan rows out), and the four empty GMV Max / split-test
tables. `definitions/sources/declarations.js` lists the reason for each.

---

## Cross-channel

| Object | Grain | Use it for |
|---|---|---|
| `reporting.v_ad_performance_daily` | channel × campaign × day | One chart covering all three channels. Adds week and month columns and the rate metrics. |
| `core.fct_ad_performance_daily` | the same | The table behind it. Query the view. |
| `reporting.v_data_gaps` | one row per gap | **Your work list.** Everything unmapped or unattributable, sized by rows and by spend. |

**Do not `SUM(spend_affected)` across gap types.** Each row is sized against its
own source, and those sources overlap. `meta_breakdown_without_ad_id` has one row
per breakdown type and each carries the *full* Meta spend, so summing its three
rows reports three times the real figure. Read the rows, sort by `spend_affected`
to prioritise, but never total the column.

Campaign grain is the coarsest grain all three channels share, so that is where
the union sits. Channel-specific detail stays in the channel marts.

**Columns worth knowing:**

- `client_name` — the canonical client, resolved through
  `core_seeds.seed_client_name_map`. **Group on this, never on
  `advertiser_raw_name`**, or one client splits into three.
- `is_client_unmapped` — TRUE when the seed has no row and the raw name is being
  used as a fallback.
- `conversions_definition` — what produced the `conversions` figure on that row.
- `interactions` and `complete_views` are NULL for channels that do not measure
  them. NULL means not measured; 0 would mean measured as zero.

Read the CM360 `media_cost` warning near the top before summing `spend` here.

---

## Reference tables

Two kinds, and they behave differently.

**Code-defined** — rebuilt from the repo on every run. Editing them in BigQuery
achieves nothing; edit the file and re-run.

| Table | Contains |
|---|---|
| `dv360_seeds.seed_metric_catalog` | 20 DV360 metrics, each with its formula and where it is available |
| `dv360_seeds.seed_dimension_coverage` | 39 dimensions, each marked available / partial / missing |
| `cm360_seeds.seed_metric` | 14 CM360 metrics with an `is_additive` flag |
| `meta_seeds.seed_action_type` | 57 Meta action types mapped to reported metric names, aliases marked |
| `meta_seeds.seed_result_type` | optimization goal → which metric counts as a "Result" |

**Hand-maintained** — rows typed in by a person. A pipeline run creates the
table if missing and then never touches the rows. Load them with `INSERT` in the
BigQuery console.

| Table | Fill it from | Until you do |
|---|---|---|
| `dv360_seeds.seed_line_item_flight` | the media plan | `flight_start_date` / `flight_end_date` are NULL; reporting falls back to first/last active date, which is delivery, not booking |
| `cm360_seeds.seed_site` | CM360 UI → Admin → Sites | sites show as `site_<id>` |
| `core_seeds.seed_client_name_map` | the client list | cross-channel reporting groups each client under three different spellings |

---

## Monitoring

Nine assertions run on every build. A red one means a number is wrong, or the
data stopped.

| Assertion | Goes red when |
|---|---|
| `assert_source_freshness` | a channel stopped delivering |
| `assert_staging_date_parsing` | a date or hour column stopped parsing |
| `assert_dv360_creative_coverage` | creative spend drops below 70% of backbone spend |
| `assert_cm360_hourly_grain` | CM360 gained duplicate rows at its base grain |
| `assert_cm360_campaign_reconciliation` | CM360's two reports disagree on impressions |
| `assert_meta_spend_reconciliation` | Meta spend changed between raw and mart |
| `assert_meta_ad_daily_grain` | duplicate or null-keyed rows at Meta's base grain |
| `assert_meta_alias_leak` | a Meta purchase alias got past the whitelist |
| `assert_meta_results_coverage` | an ad set spends money under a goal with no Results definition |

To see *why* one failed, query the view of the same name in
`dataform_assertions` — it holds the offending rows.

Things that are merely unmapped or incomplete are **not** assertions. They are
in `reporting.v_data_gaps`, because a pipeline that is red on day one teaches
everyone to ignore red.

---

## Staging layers

`dv360_staging`, `cm360_staging`, `meta_staging` are plumbing: date parsing,
type casts, de-duplication, renames. No joins, no aggregation, no business
logic. They exist so the marts can be simple. Query them when you are debugging
where a number came from — never for reporting.
