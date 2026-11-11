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
| CM360 **clicks, CTR, conversions** | `cm360_reporting.v_campaign_daily` |
| CM360 by placement, site, creative | `cm360_reporting.v_daily` (clicks here are ~40% low — see below) |
| CM360 by hour | `cm360_reporting.v_hourly` |
| CM360 viewability, serving cost | `cm360_reporting.v_daily` |
| Meta spend, conversions, ROAS, cost per anything | `meta_reporting.v_ad_daily` |
| Meta by age and gender, with conversions | `meta_reporting.v_demographics_daily` |
| Meta by age and gender **per campaign** | `meta_reporting.v_age_gender_daily` |
| Meta by country, platform, device | `meta_reporting.v_breakdown_daily` |
| Meta by placement — feed, reels, stories, right-hand column | `meta_reporting.v_placement_daily` |
| CM360 by site or by creative, **with the real media cost in EUR** | `cm360_reporting.v_site_creative_daily` |
| TikTok spend — the complete total | `tiktok_reporting.v_campaign_daily` |
| TikTok by ad, creative, video performance | `tiktok_reporting.v_daily` |
| TikTok by hour | `tiktok_reporting.v_hourly` |
| TikTok by age and gender, device, country or language | `tiktok_reporting.v_breakdown_daily` |
| TikTok by age or gender **with video 2s / 6s** | `tiktok_reporting.v_age_gender_daily` |
| TikTok **reach and frequency**, campaign × day | `tiktok_reporting.v_reach_daily` |
| TikTok **how many people a campaign reached** | `tiktok_reporting.v_campaign_reach_lifetime` |
| Google Ads spend, conversions, ROAS | `gads_reporting.v_daily` |
| Google Ads by device and network | `gads_reporting.v_device_daily` |
| Google Ads by ad group or ad | `gads_reporting.v_ad_group_daily`, `gads_reporting.v_ad_daily` |
| **Budget vs actual spend, pacing** | `gads_reporting.v_pacing` |
| **Keyword Quality Score** | `gads_reporting.v_keyword_quality` |
| Google Ads by audience segment | `gads_reporting.v_audience_daily` |
| **What people typed into Google** | `gads_reporting.v_search_terms` |
| **Google Ads keyword performance over time** | `gads_reporting.v_keyword_daily` |
| **Google Ads by country / city** | `gads_reporting.v_geo_daily` (filter `location_type`) |
| **Google Ads video / YouTube by format** | `gads_reporting.v_video_daily` |
| **Google Ads video completion funnel (25/50/75/100%)** | `gads_reporting.v_video_funnel_daily` |
| Teads spend, viewability, video completion | `teads_reporting.v_daily` |
| Teads unique viewers | `teads_reporting.v_reach_daily` |
| Taboola spend, clicks, viewability | `taboola_reporting.v_daily` |
| ChatGPT Ads spend, clicks | `chatgptads_reporting.v_daily` |
| ChatGPT Ads by country | `chatgptads_reporting.v_geo_daily` |
| Adform delivery by line item | `adform_reporting.v_daily` |
| Adform unique reach | `adform_reporting.v_reach_daily` |
| All nine channels in one chart | `reporting.v_ad_performance_daily` |
| What is broken or unmapped right now | `reporting.v_data_gaps` |
| How fresh each channel is | `reporting.v_source_freshness` |
| How a metric is defined | `dv360_reporting.v_metric_catalog`, `cm360_reporting.v_metric_catalog` |
| Whether we can split by some dimension | `dv360_reporting.v_dimension_coverage` |
| Which upstream tables the pipeline depends on | ["Source tables the pipeline needs"](#source-tables-the-pipeline-needs) |

### Where the money is

| Channel | Column | In which view | What it actually is |
|---|---|---|---|
| DV360 | `spend` | `dv360_reporting.v_daily` | Revenue in **advertiser currency**, sell-side |
| DV360 | `spend_usd` | `dv360_reporting.v_daily` | Same, in USD. Use for cross-currency totals |
| CM360 | `media_cost` | `cm360_reporting.v_daily` | See the warning below — probably a serving fee |
| CM360 | `clicks` | **`reporting.v_ad_performance_daily`** | Campaign grain. The placement-level views undercount clicks by ~65% — see below |
| Meta | `spend` | `meta_reporting.v_ad_daily` | Account currency |
| TikTok | `spend` | `tiktok_reporting.v_campaign_daily` | **Complete.** Advertiser currency |
| TikTok | `spend` | `tiktok_reporting.v_daily` | Ad level — only ~98.6% of the above |
| Google Ads | `spend` | `gads_reporting.v_daily` | **Complete**, incl. Performance Max. Account currency, from `cost_micros` |
| Taboola | `spend` | `taboola_reporting.v_daily` | **USD**, not euros. Use `spend_eur`, and read `is_fx_converted` first |
| Adform | `cost` | `adform_reporting.v_daily` | EUR. No conversion needed |
| ChatGPT Ads | `spend` | `chatgptads_reporting.v_daily` | **RON or EUR, per account.** Use `spend_eur` across accounts |
| Teads | `spend` | `teads_reporting.v_daily` | `budget_delivered`, campaign currency. **Confirmed billed** — equals `MASTER_TABLE` to the cent on every day 2026-10-01 to 10-15 |

### Where the impressions are

Every fact in every channel carries `impressions`. The ones to trust for a
**total** are the backbone views — `dv360_reporting.v_daily`,
`cm360_reporting.v_daily`, `meta_reporting.v_ad_daily`. Every other view is a
breakdown of those same impressions along one dimension, so you can compare
within it but must never add two breakdowns together.

---

## Read this before you total anything

**All nine channels are live** — measured 2026-10-13.

**CM360 moved dataset on 2026-10-12**: its tables were dropped from `kebooladv`
and recreated in **`keboola_cm360`**, fresh daily and about seven times larger.
It had looked dead since 2026-09-28; it had in fact been relocated.

**TikTok stopped on 2026-09-29 and resumed on 2026-10-13**, backfilling the
gap: 72 days to today.

**DV360 and CM360 are 2 days behind and carry 14 days each.** Both are Keboola
full loads of a rolling 14-day window, so the marts are incremental and
accumulate past it. Nothing exists before **2026-09-28** for either channel —
the earlier history was lost while the DV360 extract was truncated to one day,
and only a Keboola backfill recovers it.

| channel | tool | history | behind |
|---|---|---|---|
| Google Ads | Weld | 115 days | 0 |
| Meta | Weld | 106 days | 0 |
| TikTok | Weld | 72 days | 0 |
| DV360 | Keboola | 14 days | 2 |
| CM360 | Keboola | 14 days | 2 |

**The Keboola extracts no longer hold one day at a time — and that changed
something important.** On 2026-10-05 `fct_dv360_lineitem_daily_v5` and
`cm360_hourly` each contained a single date, so a full rebuild wrote a one-day
mart and destroyed the rest. Every DV360 and CM360 mart was made **incremental
and append-only** in response, which was correct then.

Re-checked 2026-11-03: those extracts now hold **34 to 44 days**. The premise is
gone, and append-only had been quietly costing us, because a date already
loaded was never reloaded and an upstream **restatement was ignored forever**:

| Mart | Lost to ignored restatements |
|---|---|
| `fct_cm360_placement_hourly` | 26,900 clicks and 589,778 impressions, 21–25 Oct |
| `fct_dv360_inventory_daily` | 8,844,775 impressions (3.2%) |
| `fct_dv360_reach_daily` | 381 unique reach across 12 of 34 days |
| `fct_dv360_daily` | reads 8,024 impressions HIGHER than its own source |

Clicks are attributed later than impressions, which is why CM360 lost 24% of
October clicks but only 3% of impressions: those five days were first loaded
while Keboola was still half-landed, kept their impressions, and never saw the
restatement that carried the clicks.

`fct_cm360_placement_hourly` and `fct_dv360_reach_daily` are **full rebuilds**
as of 2026-11-03. The other eight are still append-only pending a decision.

**`assert_keboola_window` is the safety net.** If a Keboola window ever
collapses below 7 days again, it fails and the rebuilt marts are **skipped**
rather than overwritten with a day of data. `assert_source_freshness` would not
catch that — it checks the latest date, not how many there are, and a one-day
extract carrying yesterday looks perfectly fresh.

Meta, TikTok and Google Ads marts were never affected and remain full rebuilds.
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

**Rate metrics do not survive aggregation — rebuild them in Looker.** Every
view here computes `cpm`, `ctr`, `cpc`, `cpa` and their `_eur` versions **at its
own row grain**. Dropped straight onto a Looker scorecard they get averaged, and
the average of ratios is not the ratio of sums: a DV360 row with 133 clicks
counts as much as a Google row with 8 million. Measured 2026-10-08 over
September, the true cross-channel euro CPC is **0.157**; averaging the `cpc_eur`
column gives about **0.76** — near enough to the unconverted mixed-currency
**0.648** to look like the FX conversion is broken when it is working perfectly.

Use calculated fields on the additive columns instead:

```
cpc_eur = SUM(spend_eur) / SUM(clicks)
cpm_eur = SUM(spend_eur) / SUM(impressions) * 1000
cpa_eur = SUM(spend_eur) / SUM(conversions)
ctr     = SUM(clicks)    / SUM(impressions)
```

And filter `is_fx_converted = true`: CM360 has no currency, so it contributes
clicks and impressions with a NULL `spend_eur`, dragging any euro rate down.

**Reach is never additive.** `unique_reach` (DV360) and `total_reach` (CM360)
are de-duplicated by the platform at one specific grain. A month's reach is not
the sum of its days. In Looker Studio set those fields' aggregation to **MAX**,
keep the reach views as their own data source, and never blend them with a
delivery source — the blend fans reach rows out against delivery rows and both
sides come out wrong.

**Currency.** DV360 spend is in advertiser currency, Meta in account currency,
CM360 has no currency column at all. Break out or filter by currency before
summing across advertisers.

### CM360 cost: two columns, one of them is not media

CM360 does not know what the media cost. It knows what it charged to serve the
ad, and that is what `mediaCost` in every Keboola CM360 table is — about
**0.20 EUR CPM**. The media cost comes from the booked rate in the media plan,
which the legacy pipeline joins in and writes to `FINAL_TABLES.CM360` — about
**3.27 EUR CPM**, sixteen times larger.

`v_site_creative_daily` carries both, named so that picking the wrong one takes
effort:

| column | what it is | rate column |
|---|---|---|
| **`media_cost_eur`** | **what the media cost** | `cpm_eur` |
| `serving_fee` | what CM360 charged to serve | `cpm_serving_fee` |

Validated 2026-11-11 against the AOS display page for
`UMS_Novo Nordisk_Menopauza`, 1 Oct – 11 Nov: 13 sites against 13, impressions
and clicks identical on every row, 13,694.91 € against 13,694.34 €, agreeing to
the cent per site.

**`media_cost_eur` is NULL for programmatic, and that is correct.** A
`BidManager_*` campaign was bought in DV360, so there is no media plan and no
booked rate — its cost lives in the DV360 views. 24 of the 25 campaigns without
cost are BidManager. Anything else that appears shows up in
`reporting.v_data_gaps` as `cm360_campaign_without_media_cost`.

No other CM360 view has `media_cost_eur`. `v_daily`, `v_hourly`,
`v_geo_daily` and `v_campaign_daily` all carry the serving fee only.

**Euros.** Two views carry `spend_eur` alongside native `spend`:
`reporting.v_ad_performance_daily` and `meta_reporting.v_ad_daily`. Both convert
through `core.dim_fx_rate`, the single definition of a rate in this warehouse —
`spend_eur = spend / rate_to_eur`, always divide. Rates are **monthly**, so a
mid-month move shows as a step on the 1st; good enough for reporting, not for
reconciling to a bank statement. Where no rate exists for a month and currency,
`spend_eur` is **NULL and `is_fx_converted` is FALSE** — it is never silently
zero and never silently unconverted, so a euro total that ignores the flag
under-reports. `meta_reporting.v_age_gender_daily` carries it too.

**`clicks` in the cross-channel view means clicks to the destination.**
DV360, CM360 and TikTok count only those. Meta's own `clicks` field also
counts likes, comments, profile taps and photo expands, so
`reporting.v_ad_performance_daily` takes Meta's `inline_link_clicks` instead —
the comparable number, and the one `meta_reporting.v_ad_daily` already uses for
its CTR and CPC. If you want Meta's all-interaction click count, it is the
`clicks` column in `meta_reporting.v_ad_daily`, and it does not belong in a
cross-channel chart.

**Conversions mean different things per channel.** DV360 counts
`Total_Conversions`, CM360 counts Floodlight totals at campaign level, Meta
counts "Results" resolved from each ad set's optimization goal. The
cross-channel fact carries a `conversions_definition` column on every row for
exactly this reason. Show it, or do not show conversions.

---

## DV360

Source: Keboola → `kebooladv.fct_dv360_*`.

### Reporting views — `dv360_reporting`

**Five views from ten source tables.** Every DV360 breakdown is
`line item × something × day` — the same spend cut differently — so the five
single-dimension ones are collapsed into `v_breakdown_daily` with a
`breakdown_type` column, exactly as Meta's five are.

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | line item × day | **The backbone.** The only place with Invalid Clicks, TrueView Views, Total Conversions and USD spend. |
| **`v_breakdown_daily`** | line item × slice × day | **Geography, URL, time of day, audience and Floodlight activity.** Filter `breakdown_type` to exactly one — five cuts of the same spend. |
| `v_creative_daily` | line item × creative × day | Creative, Asset, Size, Ad Type. Partial spend coverage (~85%) by design. |
| `v_inventory_daily` | line item × inventory context × day | Ad Position, Channel, Channel Type, Exchange, Media Type, Inventory Source, Device, Environment. |
| `v_reach_daily` | line item × day | **NON-ADDITIVE.** Unique reach, isolated so it cannot be blended with delivery. |

**`breakdown_type` values and what each slice holds:**

| type | `breakdown_1` | `breakdown_2` | metrics |
|---|---|---|---|
| `geo` | Country | Region | full set |
| `url` | App / URL | URL id | impressions, clicks, spend only |
| `timeofday` | Day of week | Hour of day | full set |
| `audience` | Audience category | — | impressions only |
| `floodlight` | Floodlight activity | Activity id | `total_conversions` only |

NULLs mean the source does not publish that metric at that grain — never zero.

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

**Four source tables, six reporting views.** CM360 publishes the same spend at
several grains, so the reporting layer is not a mirror of the sources — each
view answers a different question and **they must never be unioned or joined on
date alone**:

| view | grain | answers |
|---|---|---|
| `v_daily` | placement × ad × creative × day | the main one. Delivery with every name resolved |
| `v_hourly` | the same, × hour | dayparting |
| `v_campaign_daily` | campaign × day | totals, with Floodlight conversions collapsed |
| **`v_site_creative_daily`** | campaign × site × creative × day | **which site and which creative got the clicks** — the only detail view whose clicks match the interface |
| **`v_geo_daily`** | placement × country × city × day | **where delivery happened** |
| **`v_floodlight_daily`** | activity × ad × creative × day | **what converted, split view-through vs click-through** |
| `v_metric_catalog` | — | what each CM360 metric means |

Source: Keboola → **`keboola_cm360`** (moved there from `kebooladv` on
2026-10-12): `cm360_hourly`, `cm360_united`, `cm360_floodlightsv2`, `cm360_reach`,
`cm360_basic`.

### Reporting views — `cm360_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | placement × ad × creative × day | **The main one.** Impressions, clicks, viewable impressions, video views, media cost, plus click rate, effective CPM, effective CPC, viewable rate and video view rate. Fully labelled with advertiser, campaign, site and landing page. |
| **`v_site_creative_daily`** | campaign × site × creative × day | **The only CM360 view with real media cost, and the one to rank sites and creatives.** `media_cost_eur` is the booked rate from the media plan — the same figure the AOS display pages show. Clicks match the interface at 99.99% but are still not the quoted figure, so they are `clicks_site_level` / `ctr_site_level` / `cpc_eur_site_level`; a click total comes from `v_campaign_daily`. Also `channel_group`, shares of campaign, `is_click_tracking_only`. No country, city, placement or ad. Starts **2026-09-11**. |
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

Source: Weld → `facebook_ads_weld`. Weld lands about 137 tables; 16 are used.
One further table in that dataset is written by **Keboola**, not Weld:
`platform_position_device_keboola_v3_insights`, the placement feed.

### Reporting views — `meta_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_ad_daily`** | ad × day | **The main one, and it is wide.** Spend, impressions, clicks, link clicks, reach, frequency, CPM, CPC, CTR — plus every conversion metric as its own column, plus cost-per and ROAS for the common ones. Carries account, campaign, ad set and creative attributes including headline, primary text, CTA and thumbnail. |
| **`v_demographics_daily`** | account × age × gender × day | Spend, impressions, clicks, reach **and conversions** — post engagements, leads, the lot. Account grain: Meta's demographics feed has no campaign or ad key, so campaign name cannot be added. |
| **`v_age_gender_daily`** | campaign × age × gender × day | **The only demographic view with a campaign name.** Spend (native and euro), impressions, all-interaction clicks, **link clicks** and each bucket's share of its campaign. Reach is not here on purpose — see `v_age_gender_reach_daily`. Conversions are still missing: `demographics_age_and_gender_actions` has them but only at account grain. |
| **`v_age_gender_reach_daily`** | campaign × age × gender × asset × day | **Reach and frequency by demographic.** Quarantined like the DV360, CM360 and Teads reach views — never blend it with the one above. Answers "how often did a 25-34 woman see this"; does **not** answer "how many people did this campaign reach", which needs `campaign_insight` (frozen since 2026-09-22). |
| `v_breakdown_daily` | breakdown slice × day | Age, gender, country, publisher platform, device — the raw five, in one shape. |
| **`v_placement_daily`** | ad × platform × position × device × day | **The only view with `platform_position`.** Feed vs reels vs stories vs right-hand column vs marketplace, split by device, with each placement's share of its campaign's impressions. Spend, impressions, clicks, CPM, CPC, CTR. No reach and no conversions — neither exists at this grain. Starts **2026-10-11**; a chart spanning September shows it empty. |

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
- **`v_placement_daily` is a seventh cut of that same spend**, and the finest.
  It reconciles exactly to ad level — 476,142,179 impressions against
  476,142,150 over the 30 days to 2026-11-09, clicks identical every day —
  which is precisely why it must stand alone. One chart, one data source.
- **Its `cpc` is over all clicks, not link clicks**, because the placement feed
  carries no `inline_link_clicks`. `v_ad_daily`'s `cpc` uses link clicks. The
  two numbers are not comparable; compare placement to placement.
- **Take `campaign_name` from the view, never from the raw feed.** The feed
  stores whatever the campaign was called at extraction time. Measured
  2026-11-11: of 4,683 duplicate rows, 3,108 differed on nothing but that
  column. The view joins `dim_meta_ad` on `campaign_id` instead.
- **One Keboola table in `facebook_ads_weld` is poison and keeps the same
  name as the good one.** `platform_position_device_keboola` — no `_v3_insights`
  suffix — also requests `actions`, which the extractor flattens into child
  rows that destroy the parent metrics row. It holds only placement rows that
  had zero clicks: 0.7% of delivery, with correct values, which is what makes
  it convincing. Nothing in this project reads it.
- Three of the five breakdowns (age/gender, platform+device, region) have **no
  `ad_id`**, so those rows carry no campaign or ad labels at all. Weld does not
  sync it. Sized in `reporting.v_data_gaps`.
- **`v_age_gender_daily` is the only demographic view with a campaign key**,
  and it went daily on 2026-10-12. Until then its source published rolling
  7-day windows with a new window every day, so staging kept only Monday starts
  to stop each day being counted seven times; an unfiltered `SUM(spend)` on the
  raw table returned 29.2M against a true ~4M. Weld switched the report to
  `time_increment: 1` and the columns changed with it — `date_start` and
  `date_stop` were replaced by a single `date`. Verified: 600,800 rows, 105 days
  from 2026-06-30, spend 4,456,568.88. It now rolls up to calendar months and
  carries `spend_eur`, neither of which the weekly grain allowed.
- **Its CTR is not comparable with `v_ad_daily`'s.** The source carries no
  `inline_link_clicks`, so the column is `clicks_all` and the rate is
  `ctr_all_clicks`. It reads higher. Do not put the two on one chart.
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
| `fct_meta_age_gender_daily` | campaign × age × gender × day | The only Meta demographic fact with a campaign key. Complete since 2026-11-09 — before that staging dropped rows differing only by asset id, costing 694,133 impressions in October. |
| `fct_meta_age_gender_reach_daily` | campaign × age × gender × asset × day | Reach, quarantined. The asset id is part of the key: drop it and the reach above it is two overlapping audiences added together. |
| `dim_meta_ad` | ad | Account, campaign, ad set and creative flattened into one row. No dates, no metrics, so it cannot double-count. |

---

## TikTok

**Reach moved out of the delivery views on 2026-11-10.** It used to sit in
`v_daily`, `v_campaign_daily` and `v_hourly` beside impressions and spend,
where Looker sums it by default. One real campaign over 14 days summed to
24,265,568 reach against 25,448,770 impressions — a frequency of 1.05, when
the true largest single day was 2,435,159. It now lives in `v_reach_daily`
(campaign × day) and `v_campaign_reach_lifetime` (campaign total), with
nothing additive beside it.

Ad-level and hourly reach are deliberately not republished anywhere. TikTok
de-duplicates inside each ad and inside each hour, so no roll-up of them was
ever correct.


### Two places answer "age and gender", and they disagree on purpose

| | `v_breakdown_daily`, `breakdown_type = 'age_gender'` | **`v_age_gender_daily`** |
|---|---|---|
| vendor | Weld | Keboola |
| grain | **ad** × age × gender | **campaign** × age *or* gender |
| history | 101 days | 31 days, from **2026-10-11** |
| video 2s / 6s | **none** — the source has no video column at all | **yes** |

Neither supersedes the other. `v_breakdown_daily` crosses age with gender and
goes back further; `v_age_gender_daily` is the only place in TikTok reporting
where a video metric can be split by person rather than by device. Pick by the
question and **never union them** — same spend, different cuts.

Inside `v_age_gender_daily`, **always filter `breakdown_type` to exactly one.**
Age and gender arrive as two separate TikTok reports, not as a grid, and each
totals the campaign on its own. A scorecard with no filter reports exactly
double and nothing about it looks wrong.

`retention_6s_of_2s` is what the view was built for: of the people who watched
two seconds, how many reached six. Measured 11 Oct – 9 Nov it runs 27.8% for
13-17 and 33.0% for 18-24, with 45-54 lowest at 28.8% despite heavy delivery.

Source: Weld → `tiktok_ads`. **The only channel currently delivering fresh data
every day.**

Weld lands 41 tables and 21 of them carry identical metrics — the same money at
every hierarchy level, every time grain and every breakdown. Eleven are used.

### Reporting views — `tiktok_reporting`

**Four views.** `v_demographics_daily` and `v_platform_daily` were deleted on
2026-10-13 — both were `v_breakdown_daily` with a `breakdown_type` filter
hard-coded, so three views maintained one query.

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | ad × day | **The main one.** Every metric TikTok publishes at ad level, plus campaign, ad group and creative attributes. ~98.6% of spend — TikTok cannot attribute every impression to a named ad. |
| **`v_campaign_daily`** | campaign × day | **COMPLETE spend.** The source of truth for TikTok money, and what `core` reads. |
| **`v_breakdown_daily`** | ad × slice × day | Age/gender, country, language and platform. **Filter `breakdown_type`** — four cuts of the same spend. |
| **`v_reach_daily`** | campaign × day | **Reach and frequency.** Quarantined, like the DV360, CM360, Teads and Meta reach views. Never blend it with the two above: same delivery, counted again. |
| **`v_campaign_reach_lifetime`** | campaign | **The only campaign-level reach in the warehouse, for any channel.** Cumulative since the campaign started, which is what a report on a finished campaign needs. Coverage is ~58% of delivering campaigns; check `has_reach_figure` before charting. |
| `v_hourly` | ad × hour | Dayparting. |

**Play-time averages are non-additive.** `avg_play_time_per_view` and
`avg_play_time_per_user` are weighted averages of a per-row average: correct at
ad × day, approximate above it. TikTok publishes both and they mean different
things — per view divides by plays, per user divides by reach.

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

## Google Ads

Source: Weld → `google_ads`. **Phase 1 is campaign level.** Ad groups, ads,
keywords and search terms follow.

### Reporting views — `gads_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | campaign × day | **The main one.** Complete spend including Performance Max, plus impressions, clicks, interactions, video views, conversions, conversion value, view-through conversions and Active View — with CPM, CTR, CPC, CPA, conversion rate, viewable rate and ROAS. |
| `v_device_daily` | campaign × device × network × day | Device and network split. |
| **`v_pacing`** | campaign × day | **Booked budget against actual spend**, with Google's own recommended budget, target CPA/ROAS and real flight dates. Nothing else in this warehouse can do this. |
| `v_ad_group_daily` | ad group × day | **Excludes Performance Max.** Compare ad groups; never total money. |
| `v_ad_daily` | ad × day | Same PMax blind spot. The only Google view with `video_views`. Also carries `ad_strength`, `policy_approval_status` and `is_not_serving`. |
| **`v_keyword_quality`** | keyword | **Quality Score 1–10 and its three components.** A snapshot, not a history — the source carries no date. |
| `v_audience_daily` | ad group × audience × day | Audience performance. **Segments have no name** — only a criterion id. |
| **`v_video_daily`** | video ad × day | Video and YouTube ads only, by format: TrueView in-stream, responsive, non-skippable, bumper, efficient reach, in-display, YouTube audio. Cost per view and view rate. Formats, not the funnel. |
| **`v_video_funnel_daily`** | campaign × network × day | **The completion funnel.** 25/50/75/100% rates, TrueView views, engagements, all-conversions. Rates are NON-ADDITIVE — see below. |

**Caveats that matter:**

- **Performance Max is campaign level only.** It has no ad groups at all — about
  a fifth of spend. Any Google Ads figure built up from ad groups (phase 2)
  silently omits it, so those views will carry a warning.
- **`conversions` is fractional.** Google splits an attributed conversion across
  touchpoints, so 0.34 conversions is a normal value, not a bug.
- **`view_through_conversions` is a separate path.** Never add it to
  `conversions`.
- **Unlike Meta and TikTok breakdowns, `v_device_daily` IS additive.** Device and
  network are disjoint slices, so summing it equals `v_daily` to the cent.
  `assert_gads_device_reconciliation` proves that on every run.
- **`is_test_account`** marks accounts whose spend is not real money. They are
  excluded from `core` but still visible here — filter them out of anything
  client-facing.
- `viewable_rate` divides by **measurable** impressions, which is Google's own
  definition. It is therefore comparable with the Google Ads UI, unlike CM360's.
- **Achieved impression share is not available.** Confirmed 2026-09-24: the only
  `impression_share` columns anywhere in `google_ads` are
  `target_impression_share_*` on the bidding-strategy table, which are settings.
  Impression share, and share lost to budget or rank, are not synced.
- **`conversion_action` and `asset` are in zero tables.** No per-conversion-type
  breakdown, and Performance Max has no asset detail — 20% of spend that cannot
  be opened up at all.
- **Budgets can be shared.** Where `is_shared_budget` is TRUE, `budget_amount`
  belongs to a group of campaigns and campaign-level utilisation is meaningless.
  Group by `budget_id` instead, or filter them out. Listed in `v_data_gaps`.
- **There is no creative text.** Weld's `ad` table is 23 columns and none is a
  headline, description, image or card. `ad_strength`, `final_urls` and
  `display_url` are all you get.
- **Format and funnel live in different views, at different grains.** `ad.type`
  identifies 27,864 video ads across seven formats, so `v_video_daily` compares
  bumper against in-stream on cost per view — at AD level. The funnel arrived
  2026-10-02 in `google_ads.youtube_ads` and is in `v_video_funnel_daily` — at
  CAMPAIGN × NETWORK level. There is no grain where you have both. Earned Views,
  Likes, Shares, Subscribers, Playlist Additions and video title are still not
  synced anywhere.
- **The quartile rates cannot be aggregated.** Their denominator is video
  impressions, which is not in the feed. Solving for the value that makes all
  four quartiles whole gives 561 where `impressions` is 571, and 1,435 where it
  is 1,838. Tested 2026-10-02 across every channel type: `impressions` works as
  the denominator for 230 of 7,971 VIDEO rows (2.9%), the coincidence rate. So
  the rates are correct at campaign × network × day and nowhere coarser. Never
  `SUM`, never `AVG` above that grain, set Looker aggregation to MAX. Same rule
  as `reach`. `retention_25_to_100` is exact, because both rates share the same
  hidden denominator and it cancels.
- **Always filter `v_geo_daily` to one `location_type`, and default to
  `LOCATION_OF_PRESENCE`.** Unlike Meta's five breakdowns, these two are **not**
  symmetric. Measured 2026-10-12 from 2026-09-01:

  | `location_type` | places | spend | share |
  |---|---|---|---|
  | `LOCATION_OF_PRESENCE` | 88 | 5,189,208.84 | 93.3% |
  | `AREA_OF_INTEREST` | 50 | 372,461.32 | 6.7% |

  `LOCATION_OF_PRESENCE` is where the user physically was and covers all
  delivery. `AREA_OF_INTEREST` exists only where the query named a place —
  "hotels Paris", "dentist Cluj" — and most searches name none. So this is not
  a double-count of equal halves: summing both overstates by about **7%**, and
  charting interest alone shows 7% of your spend while looking like a complete
  map. Use presence unless the question is specifically "which places were
  people searching *about*".
- **`google_ads.youtube_ads` DUPLICATES ROWS since 2026-10-14.** Its sync was
  switched to incremental and now inserts instead of replacing: 83
  campaign-day-network keys arrived twice, from the 13 and 14 October runs,
  with identical `cost_micros`. It was clean on 2026-10-02 — 142,678 rows,
  142,678 keys. **Never query this table directly without de-duplicating.**
  `stg_gads_campaign_network_daily` does it with a QUALIFY, so everything in
  the warehouse is safe; `assert_gads_video_grain` watches the raw table and
  stays red until Weld fixes the load.
- **`google_ads.youtube_ads` is not a YouTube table, and its spend is a
  duplicate.** It covers all seven channel types, and its `cost_micros` matches
  `campaign_stats` to the cent (23,575 September campaign-days, zero differing,
  both 5,240,904.57). Staging deliberately omits the spend column. The two do
  drift by rounding as Google restates — 35 campaign-days of 28,015, total 7.59,
  measured 2026-10-05 — which is reported as `gads_youtube_ads_spend_drift` in
  `v_data_gaps` and is deliberately not an assertion.
  `fct_gads_campaign_daily` remains the only Google Ads money source.
- **`view_rate` is not comparable across formats.** Bumper and non-skippable
  ads count a view on essentially every impression; skippable ones do not.
  Compare within a format.
- **Audience segments have no name**, only a criterion id.
- **Quality Score has no history** — `ad_group_criterion` carries no date, so
  `v_keyword_quality` is today's snapshot and cannot be trended.
- **Budget and bidding have no history** — those source tables carry no date, so
  `v_pacing` applies today's budget to past days. Read trends, not exact
  past-day variance.

### Marts — `gads_marts`

| Table | Grain | Notes |
|---|---|---|
| `fct_gads_campaign_daily` | campaign × day | **Source of truth for Google Ads spend.** What `core` reads. |
| `fct_gads_campaign_device_daily` | campaign × device × network × day | The source grain, kept intact. Reconciles exactly to the above. |
| `fct_gads_ad_group_daily` | ad group × day | Excludes PMax by construction. |
| `fct_gads_ad_daily` | ad × day | Key is **adgroup_id + ad_id**, never ad_id alone. Only Google fact with `video_views`. |
| `fct_gads_account_daily` | account × day | Exists to reconcile against the campaign rollup. |
| `fct_gads_geo_daily` | day × ad group × geo × location type × device × network | **Never sum across `location_type`.** |
| `dim_gads_geo` | location | Delivery-driven, so only places that actually ran. Names from `geo_target`. |
| `fct_gads_search_term_daily` | day × campaign × ad group × term × match type × status | Breakdown of ad group spend. PMax has no search terms. |
| `fct_gads_keyword_daily` | day × keyword × device × network | Join `dim_gads_keyword` on **both** adgroup_id and criterion_id. |
| `fct_gads_campaign_video_daily` | campaign × network × day | Video funnel. **Carries no spend by design** — its source duplicates `campaign_stats` exactly. |
| `dim_gads_campaign` | campaign | Campaign, account, currency, **real booked flight dates**, budget, recommended budget and bid strategy targets. Driven by delivery. |
| `dim_gads_ad_group` | ad group | Delivery-driven; names resolve from the fact when the entity sync lags. |

Google Ads is the **only** channel that provides real booked `flight_start_date`
and `flight_end_date` from the platform. DV360 needs them typed in by hand.

### Staging — `gads_staging`

Thirteen views. Every one over a stats table filters `_weld_deleted_at IS NULL` —
Google Ads is the only source in this project that soft-deletes rows, and
without the filter deleted rows keep contributing spend forever.

Money arrives as `cost_micros`; `metrics.micros()` converts it.

### What these demographic views cannot give you, and why

Both channels stop short of the usual request, and neither gap is fixable here:

| Wanted | Meta | TikTok |
|---|---|---|
| Campaign name / objective | **yes** — via `v_age_gender_daily`. The `demographics_*` feed still has no `ad_id` or `campaign_id`. | yes |
| Reach | yes | **no** — not in the demographic report |
| Video views | 3-second only, **not ThruPlay** | **no** at this grain |
| Post engagements / likes, comments, follows | yes | **no** at this grain |
| Device crossed with age and gender | no | no — separate breakdown |

Both are Weld sync scope questions. `video_thruplay_watched_actions` is a
standard action type and is not synced — confirmed 2026-09-23, the only
video action in the feed is `video_view`, 417,210 of them.

**Campaign-level age and gender was the long-standing gap, and it is now
half-closed.** `facebook_ads_weld.age_gender` arrived on 2026-10-02 carrying
`campaign_id`, which no `demographics_*` table does. It is exact but weekly, so
`v_age_gender_daily` answers both *"how did this campaign's audience split"*
and *"how much did we spend on women 35-44 in September"*.

**Corrected 2026-11-09.** The source was never limited to three metrics. It
carries `reach`, `frequency` and `inline_link_clicks` as well, and this
document, the staging view and the reporting view all said otherwise for five
weeks. Link clicks are now in `v_age_gender_daily`; reach went to
`v_age_gender_reach_daily`, quarantined, because it is non-additive and
everything else in that view is additive.

The same correction found a real defect: the source grain includes
`ad_format_asset` and the staging key did not, so the de-duplication was
discarding genuine rows — 694,133 impressions and 3,929.75 spend in October
alone. `assert_meta_age_gender_grain` now reconciles staging volume against the
raw table, which is the check that would have caught it.

The remaining gap is conversions: `demographics_age_and_gender_actions` has
them but only at account grain, so an `age_gender_actions` sibling with a
campaign key is still needed.

---

### CM360 clicks: use the cross-channel view, not `v_daily`

CM360 ships three reports that agree on impressions to within 0.4% and
disagree about **clicks by 3x**, because it cannot attribute a click below
campaign level and returns zero for most detailed rows:

| Report | Grain | October clicks |
|---|---|---|
| `cm360_reach` | campaign × day | **425,356** |
| `cm360_united` | + placement, ad, creative, country, city | 188,511 |
| `cm360_hourly` | + hour, placement, ad, creative | 143,202 |

Per campaign the gap is brutal — BAT glo HYPER pro+ shows 1,532 clicks in the
hourly report and **88,959** in the campaign one.

**Which is right is not a judgement call.** DV360 media trafficked through
CM360 is click-tracked independently by DV360, which counts 54,637. The
campaign report counts 52,220 — within 4%. The hourly report counts 11,084.

`reporting.v_ad_performance_daily` and `cm360_reporting.v_campaign_daily` both
read CM360 clicks from `fct_cm360_reach_daily.clicks_check`, which despite the
name is the authoritative count.

**`cm360_reporting.v_daily` still carries the placement-level clicks**, and
always will — they are the only figure that exists at placement grain. Right
for ranking placements against each other, wrong for any total.

**There is now a middle report, and for sites and creatives it is the right
one.** `cm360_basic` asks for campaign × site × creative — three dimensions
instead of six — and the clicks survive. Measured 3–9 November against
`cm360_reach`, the figure that matches the interface:

| Source | Grain | Clicks | Kept |
|---|---|---|---|
| `cm360_reach` | campaign | 140,790 | 100% |
| **`cm360_basic`** | **+ site, creative** | **140,779** | **99.99%** |
| `cm360_united` | + placement, ad, country, city | 57,149 | 40.6% |

Impressions make the same point from the other side: `cm360_united` reports
60.7M for those campaign-days against the campaign report's 42.8M — **42%
more**, because its extra dimensions split rows the campaign total counts once.
`cm360_basic` reports 42.7M.

So: **`v_site_creative_daily` for a site or creative question, `v_geo_daily`
for country and city, `v_campaign_daily` for anything quoted against the
interface.** Never two of them in one chart.

**That last clause is not softened by the 99.99%.** A CM360 click quoted to
anyone comes from the campaign report, whatever grain the question arrived at
— one report, one number. `v_site_creative_daily` therefore names its columns
`clicks_site_level`, `ctr_site_level` and `cpc_serving_fee_site_level`: they
sit one entry away from `v_campaign_daily`'s `clicks` in a Looker field list,
and a short name there gets picked by accident. Use them to rank sites and
creatives against each other, which the campaign report cannot do because it
has neither column.

**41.5% of the clicks in `cm360_basic` have no impression beside them, and
that is correct.** Of 1,148,317 clicks, 476,367 sit on rows with zero
impressions — CM360 serves some placements and only tracks others. The largest
single case is site `DART Search : Google` with creative `(not set)`: 455,525
clicks, zero impressions, which is search click tracking where the impression
happened on Google. These clicks are in the campaign total too, which is why
the table reconciles at 99.99% **with** them and 61.1% without. The view flags
them as `is_click_tracking_only` and returns NULL CTR for them: **filter them
out of a rate chart, never out of a click total.**

Verified against the CM360 interface on 2026-11-03, ALLIANZ ASIGURARI,
10–31 October:

| | impressions | clicks | CTR |
|---|---|---|---|
| CM360 interface | 11,017,101 | 49,256 | 0.45% |
| `v_campaign_daily` | 11,017,422 | **49,256** | 0.447% |
| `v_daily` | 11,017,422 | 29,487 | 0.268% |

`check_cm360_vs_ui.sql` in the repo root runs that comparison for any
advertiser — edit the four values at the top.

---

## Teads

Source: Keboola → `keboola_teads`. **Landed 2026-10-30.** Two tables, and that
is the whole channel.

Teads is bought as managed insertion orders, so there is no account hierarchy
and no entity endpoint. One flat table carries seat, advertiser, campaign, line
item and creative names beside their ids — which is why **this channel has no
dimension tables**. The names live on the fact.

### Reporting views — `teads_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | creative × day | **The main one.** Delivery, money, Moat viewability and video completion. Roll it up to line item, campaign or advertiser in Looker. |
| `v_reach_daily` | creative × billable event × day | Unique viewers. **Never blend it with `v_daily`** — the blend fans reach out against delivery rows and both sides lie. |

### Marts — `teads_marts`

| Table | Grain | Notes |
|---|---|---|
| `fct_teads_creative_daily` | creative × day | **THE Teads fact.** Carries every name itself; `core` rolls it up to campaign. |
| `fct_teads_reach_daily` | creative × billable event × day | `unique_viewers`, quarantined with nothing additive beside it. |

### Staging — `teads_staging`

Two views, both de-duplicated. `stg_teads_uv` deliberately drops the
impressions, video starts and video completes the source repeats, so only one
table in the warehouse answers "how many impressions did this creative get".

### Four things that will catch you out

1. **`completion_rate` here is not the one in the other channels.** Teads
   delivers `video_starts`, so this is completes ÷ **starts** — the real VTR.
   DV360, TikTok and Google Ads divide by impressions because their feeds carry
   no start count. Same column name, different measurement.
2. **`viewable_rate` here is not the one in CM360 either.** Moat gives the
   measurable denominator, so this is viewable ÷ **measurable**, the true rate.
   The CM360 column divides by impressions and reads lower. Check
   `measurable_rate` first — a low one makes the viewability figure unreliable.
3. **There are two money columns and `spend` is the right one.**
   `budget_delivered` equals `MASTER_TABLE` to the cent on all 15 days from
   2026-10-01 to 10-15; `budget_spent` matches on 8 and runs 6-10% low from
   10-09. `src_budget_spent` carries the other column for audit. Note that
   from **2026-10-16** `spend` runs ~46 EUR/day above `MASTER_TABLE` — that is
   `MASTER_TABLE` missing **line item 1492085**. Verified day by day over all
   14 days it ran: subtract that line item's spend from the daily difference
   and the residual is 0.00 every day. Whether that is a `MASTER_TABLE` bug or
   a non-billable placement is **unresolved** — see the Teads section of
   README.md before quoting either figure.
4. **No conversions at all.** The feed has delivery, money and viewability and
   nothing attributed, so `conversions` is NULL in `core`. `billable_events` is
   a billing count, not a conversion, and is deliberately not promoted.

### The one good thing about this source

`extracted_at`. It is the **only** extract in the project that says when it was
loaded, so its staging de-duplicates on *newest wins* rather than the
largest-wins workaround every other Keboola source needs. A figure the platform
revises downward is handled correctly here and nowhere else.

Whether it needs to is **unsettled**. On 2026-10-29 `teads_uv_daily` held 4,880
rows for 2,972 grain keys across 3 extractions, 39% inflation. On 2026-10-30 it
held 2,851 for 2,851 with one extraction, and `teads_daily` 3,175 for 3,175 —
both exactly clean. Either the load was switched to replace, or the 29th was a
backfill. The de-duplication stays because on a clean table it is provably a
no-op and it costs nothing; `v_data_gaps.teads_duplicate_rows` reads zero today
and is how a relapse shows up.

### Freshness

Delivery reaches 2026-10-29 and unique viewers only 2026-10-27, measured
2026-10-30 — **the reach feed runs two days behind.** Teads shares the one
project-wide 2-day threshold, so `Teads / unique viewers` fails
`assert_source_freshness` on day one. Both tables start 2026-09-30.

---

## Taboola

Source: Keboola → `keboola_taboola`. **Landed 2026-11-05.** Two tables, one
advertiser, 289 delivery rows. The smallest channel in the warehouse.

### Reporting view — `taboola_reporting`

| View | Grain | Use it for |
|---|---|---|
| **`v_daily`** | campaign × day | Everything. It is the only Taboola view, because campaign × day is the only grain the feed has. |

### Marts — `taboola_marts`

| Table | Grain | Notes |
|---|---|---|
| `fct_taboola_campaign_daily` | campaign × day | THE fact. No roll-up — the source is already at this grain, which is also what `core` needs. |
| `dim_taboola_campaign` | campaign | Advertiser slug, pricing model, bid strategy, daily cap. 16 rows, 9 with delivery, flagged by `has_delivery`. |

### Three things that will catch you out

1. **`spend` is in US dollars.** The only non-EUR spend in the warehouse. Use
   `spend_eur` for anything cross-channel, and check `is_fx_converted` — it is
   FALSE for September and October 2026, which is 72% of the channel, because
   `MonthlyExchangeRate` has no `ExchangeRateUSD` for those months yet.
2. **`date` in the RAW table is a STRING with a time part.** `SAFE_CAST` gives
   NULL on every row; use `SUBSTR(date,1,10)`. Staging already handles it — this
   only bites ad-hoc queries against `keboola_taboola`.
3. **There are no conversions**, though every campaign bids MAX_CONVERSIONS.
   `conversions` is NULL in `core` and there is nothing else to use.

---

## Cross-channel

| Object | Grain | Use it for |
|---|---|---|
| `reporting.v_ad_performance_daily` | channel × campaign × day | One chart covering all nine channels. Adds week and month columns and the rate metrics. |
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

## Source tables the pipeline needs

`definitions/sources/declarations.js` is the complete list of external
dependencies. **If a table is not in that file, nothing in this project reads
it.** A model physically cannot: `ref()` would not resolve and compilation
fails.

**57 declared, 56 required.** Remove any of those upstream and the run breaks.

### `kebooladv` — Keboola → DV360

9 declared, 8 required. **CM360 left this dataset on 2026-10-12** — see
`keboola_cm360` below.

| Source table | Read by | Note |
|---|---|---|

### `keboola_cm360` — Keboola → CM360

4 declared, 4 required. **CM360 moved here from `kebooladv` on 2026-10-12**:
the old tables were dropped, these were created, and the extract went from
frozen since 2026-09-28 to fresh daily with ~7× the rows.

| Source table | Read by | Note |
|---|---|---|
| `cm360_hourly` | `stg_cm360_hourly` | CM360 backbone, hourly. Column names unchanged from the old location — staging needed only a repoint. 11,804 → 82,413 rows. |
| `cm360_united` | `stg_cm360_united`, `stg_cm360_campaign_daily` | **New, and the largest at 235,821 rows.** Daily rather than hourly, and the first CM360 source carrying **names** (advertiser, campaign, site, placement, ad, creative) plus **country and city**. |
| `cm360_floodlights` | `stg_cm360_floodlight`, `fct_cm360_campaign_daily` | **Replaces `cm360_standard_table`.** Conversions by Floodlight activity, with revenue and the view-through / click-through split. Carries `advertiserId`, which the old table did not. Gained **`impressions`** on 2026-10-16 — Floodlight Impressions, one of the two CM360 metrics that had no source. Note it also ships `impressions_str`, the same value as STRING; staging uses the INTEGER. |
| `cm360_reach` | `stg_cm360_reach` | Non-additive unique reach. 136 → 439 rows. |

| `fct_dv360_creative_daily` | `stg_dv360_creative` |  |
| `fct_dv360_floodlight_daily` | `stg_dv360_floodlight` | **EMPTY — 0 rows.** Staged with no mart behind it. Still required: drop it and the run breaks. |
| `fct_dv360_geo_daily` | `stg_dv360_geo` | Country only, ~61 rows/month. |
| `fct_dv360_inventory_daily` | `stg_dv360_inventory` | Holds ONE day of data. |
| `fct_dv360_lineitem_daily_v5` | `stg_dv360_lineitem` | DV360 backbone. The only source with Partner, Campaign, Invalid_Clicks, TrueView and USD spend. |
| `fct_dv360_placement_daily` | `stg_dv360_placement` |  |
| `fct_dv360_reach_daily` | `stg_dv360_reach` |  |
| `fct_dv360_timeofday_daily` | `stg_dv360_timeofday` |  |
| `fct_dv360_youtube_daily` | — | **Not read.** Declared so the graph records the decision — it duplicates TrueView views the backbone already has. |

### `facebook_ads_weld` — Weld → Meta

16 declared, 16 required.

| Source table | Read by | Note |
|---|---|---|
| `age_gender` | `stg_meta_age_gender` | **The only Meta demographic source with `campaign_id`.** Appeared 2026-10-02 as rolling 7-day windows; switched to daily 2026-10-12. Does not follow the `demographics_*` naming, so probably a hand-built Weld model and able to change again — it already has. Its grain includes `ad_format_asset`, a Meta asset id delivered as a FLOAT; missing that column from the staging key cost five weeks of dropped rows. Also carries `reach`, `frequency` and `inline_link_clicks`, all three documented in this repo as absent until 2026-11-09. |
| `account` | `stg_meta_account` | Meta and Google Ads each have one. For Google Ads it is the only source of `currency_code` and of the manager / test_account flags. |
| `ad` | `stg_meta_ad` | Meta and TikTok each have one, and they are unrelated tables. |
| `ad_roas_insight` | `assert_meta_spend_reconciliation`, `stg_meta_ad_insight` | Meta backbone — ad x day metrics. |
| `ad_roas_insight_action_values` | `stg_meta_ad_action` | Money value per Meta conversion. |
| `ad_roas_insight_actions` | `assert_meta_alias_leak`, `stg_meta_ad_action` | Meta conversions, long format. |
| `ad_set` | `stg_meta_ad_set` |  |
| `campaign` | `stg_meta_campaign` | Meta, TikTok and Google Ads each have one — three unrelated tables sharing a name. Google Ads' carries REAL booked flight dates. |
| `creative` | `stg_meta_creative` |  |
| `custom_conversion` | `stg_meta_custom_conversion` | Resolves `offsite_conversion.custom.<id>` into readable names. |
| `demographics_age_and_gender` | `stg_meta_breakdown` |  |
| `demographics_country_ad` | `stg_meta_breakdown` |  |
| `demographics_delivery_platform_ad` | `stg_meta_breakdown` |  |
| `demographics_delivery_platform_and_device` | `stg_meta_breakdown` |  |
| `demographics_region` | `stg_meta_breakdown` |  |

### `tiktok_ads` — Weld → TikTok

11 declared, 11 required.

| Source table | Read by | Note |
|---|---|---|
| `ad` | `stg_tiktok_ad` | Meta and TikTok each have one, and they are unrelated tables. |
| `ad_age_gender_report` | `stg_tiktok_breakdown` |  |
| `ad_country_report` | `stg_tiktok_breakdown` |  |
| `ad_daily_report` | `stg_tiktok_ad_daily` | TikTok ad detail, ~98.6% of spend. |
| `ad_group` | `stg_tiktok_ad_group` |  |
| `ad_hourly_report` | `stg_tiktok_ad_hourly` |  |
| `ad_language_report` | `stg_tiktok_breakdown` |  |
| `advertiser` | `stg_tiktok_advertiser` | The ONLY TikTok table carrying `currency`. |
| `campaign` | `stg_tiktok_campaign` | Meta, TikTok and Google Ads each have one — three unrelated tables sharing a name. Google Ads' carries REAL booked flight dates. |
| `campaign_daily_report` | `stg_tiktok_campaign_daily` | TikTok **complete** spend. What `core` reads. |
| `campaign_platform_report` | `stg_tiktok_breakdown` |  |

### `google_ads` — Weld → Google Ads

18 declared, 18 required. **Every stats table here must filter
`_weld_deleted_at IS NULL`** — Google Ads is the only source in this project
that soft-deletes rows.

| Source table | Read by | Note |
|---|---|---|
| `account` | `stg_gads_account` | Meta and Google Ads each have one. For Google Ads it is the only source of `currency_code` and of the manager / test_account flags. |
| `account_stats` | `stg_gads_account_daily` | The true account total, reconciled against the campaign rollup. |
| `campaign` | `stg_gads_campaign` | Meta, TikTok and Google Ads each have one — three unrelated tables sharing a name. Google Ads' carries REAL booked flight dates. |
| `campaign_stats` | `stg_gads_campaign_daily` | Google Ads **complete** spend. Performance Max reports here and at no level below — about a fifth of spend. |
| `campaign_budget` | `stg_gads_campaign_budget` | Booked budget plus Google's own recommendation. No date column — current state only. |
| `campaign_bidding_strategy` | `stg_gads_campaign_bidding` | Bid strategy and its targets. `target_impression_share_*` are SETTINGS; achieved impression share is not synced. |
| `ad_group` | `stg_gads_ad_group` | |
| `ad_group_stats` | `stg_gads_ad_group_daily` | Excludes PMax by construction — PMax has no ad groups. |
| `ad` | `stg_gads_ad` | Ad type, status, URLs, ad strength, policy approval. **No creative text** — 23 columns, none a headline or description. |
| `ad_stats` | `stg_gads_ad_daily` | The only stats table with `video_views` at ad level. |
| `ad_group_criterion` | `stg_gads_keyword` | Keywords and the full Quality Score: score, expected CTR, ad relevance, landing page. |
| `audience_stats` | `stg_gads_audience_daily` | Keyed on `criterion_id`. The audience NAME needs `user_list` / `user_interest` / `topic`, none declared. |
| `ad_group_bidding_strategy` | `stg_gads_ad_group_bidding` | 63k rows. Ad-group bid overrides plus the EFFECTIVE target and whether it was set here or inherited from the campaign. No date. |
| `ad_group_country_stats` | `stg_gads_geo_daily` | 404k rows. **The only geography in the Google Ads stack.** Carries `location_type`. |
| `geo_target` | `stg_gads_geo_target` | 274k rows. Global location reference list — the name behind every geo id. |
| `search_term_stats` | `stg_gads_search_term` | 5.8M rows. The actual queries, the matched keyword, and whether each is added or negated. **All metrics arrive as FLOAT64**, cost_micros included. |
| `keyword_stats` | `stg_gads_keyword_daily` | 969k rows. Keyword performance by day — the history `ad_group_criterion` has never had. **Every id column is STRING here**, unlike every other google_ads table. |
| `youtube_ads` | `stg_gads_campaign_network_daily` | **The name is wrong.** Campaign × day × network across all seven channel types. Read ONLY for the video quartiles, `video_trueview_views`, `engagements` and `all_conversions`. Its `cost_micros` duplicates `campaign_stats` exactly and is not staged. |

### `keboola_tiktok` — Keboola → TikTok (video only)

1 declared, 1 required. Not a second source of truth: the same data Weld
already delivers in `tiktok_ads.campaign_platform_report`, verified identical
on all eight overlapping days. Read **only** for the three video columns Weld
does not carry.

| Source table | Read by | Note |
|---|---|---|
| `titktok_platform` | `stg_tiktok_breakdown` | ad × platform × day. **The name is misspelled at source** — `titktok`, with an extra `t`. Spelled here as the source spells it; if Keboola corrects it the ref breaks loudly, which is the right failure. 8 days of history against Weld's 88, and two days of lag against Weld's one, so Weld stays the base and this LEFT JOINs on. |

### `keboola_teads` — Keboola → Teads

2 declared, 2 required. **The only source in the project that carries a load
timestamp** (`extracted_at`), which is what lets its staging de-duplicate on
newest-wins instead of largest-wins.

| Source table | Read by | Note |
|---|---|---|
| `teads_daily` | `stg_teads_daily` | day × seat × advertiser × campaign × line item × creative. Delivery, two money columns and Moat viewability. `campaign_currency` added 2026-10-30. |
| `teads_uv_daily` | `stg_teads_uv` | The same grain plus `line_item_billable_event`, carrying `unique_viewers`. Its impressions / video starts / video completes repeat `teads_daily` and are deliberately **not** staged. |

**Both were clean on 2026-10-30** — one extraction each, rows equal to grain
keys, 3,175 and 2,851, window 2026-09-30 to 10-29 and 10-27. One day earlier
`teads_uv_daily` carried 4,880 rows for 2,972 keys across 3 extractions.
Unexplained. Staging de-duplicates both regardless; never query either raw
without doing the same.

### What is deliberately excluded

- **Meta** — Weld lands ~137 tables; 14 are used.
- **TikTok** — Weld lands 41; 11 are used. Twenty-one carry *identical* metrics:
  the same money at every hierarchy level, time grain and breakdown.
- **Google Ads** — `search_term_stats`, `keyword_stats`, the geo tables and the
  audience name lookups (`user_list`, `user_interest`, `topic`) are not declared
  yet. Achieved impression share, conversion action/category/source, PMax asset
  groups and creative text are not synced by Weld at all.
- **DV360** — `fct_dv360_youtube_daily` is declared but not read; it duplicates
  a metric the backbone already carries.

### `account`, `campaign` and `ad` each exist more than once

`facebook_ads_weld.campaign`, `tiktok_ads.campaign` and `google_ads.campaign`
are three unrelated tables sharing a name; `account` and `ad` are shared twice
over. This only works because **every source reference names its dataset**:

```sqlx
FROM ${ref({ schema: constants.DATASETS.gads, name: "campaign" })}
```

A bare `ref("campaign")` fails compilation rather than guessing.

### Google Ads soft-deletes rows

`google_ads` is the only source that does. Fourteen of its tables carry
`_weld_deleted_at`, and **every staging view over them must filter
`_weld_deleted_at IS NULL`** or deleted rows keep contributing spend forever.
Checked 2026-09-23: neither `facebook_ads_weld` nor `tiktok_ads` has the column.

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
