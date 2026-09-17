# ums-media-warehouse

Dataform project for the UMS advertising warehouse in `ums-digital-core-automation`.
One repo for every paid channel: DV360, CM360, Meta and TikTok are modelled
here today, Google Ads next.

Everything in `definitions/` supersedes the hand-run scripts in `all_scripts/`.
Those are kept as the record of what was deployed before; nothing reads them.

**Looking for which table to query?** That is [CATALOG.md](CATALOG.md) — every
table and view, what it is for, and what will catch you out. This file is about
how the project is built and maintained.

---

## Layers

Data flows in one direction and never skips a layer.

| Layer | Folder | Datasets | Type | What lives there |
|---|---|---|---|---|
| Sources | `definitions/sources/` | `kebooladv`, `facebook_ads_weld` | declarations | Declarations only. Nothing here is ever written to. |
| Staging | `definitions/staging/<channel>/` | `<channel>_staging` | views | Date parsing, type fixes, de-duplication, renames. No joins, no aggregation, no business logic. |
| Seeds | `definitions/seeds/<channel>/` | `<channel>_seeds`, `core_seeds` | tables + operations | Reference data. The only place a human decides anything. |
| Marts | `definitions/marts/<channel>/` | `<channel>_marts` | partitioned, clustered tables | One table per grain. Additive metrics only — a ratio is never stored. |
| Core | `definitions/core/` | `core` | table | Cross-channel union at campaign grain. |
| Reporting | `definitions/reporting/<channel>/` | `<channel>_reporting`, `reporting` | views | What Looker Studio connects to. Calculated metrics live here. |
| Assertions | `definitions/assertions/` | `dataform_assertions` | assertions | Checks that should turn the workflow red. |

`includes/metrics.js` holds every calculated metric — CPM, CTR, CPA, the rate
metrics. A reporting view never writes `SAFE_DIVIDE` by hand. Change a
definition once and every channel, every dashboard, follows.

`defaultLocation: EU` in `workflow_settings.yaml` is not optional. Every dataset
involved is EU and BigQuery cannot join across locations.

### Why ratios are never stored

A stored CTR is only correct at the grain it was stored at. Sum a column of
stored CTRs in Looker Studio and you get nonsense; average them and you get a
different kind of nonsense. Marts store numerators and denominators, reporting
views divide. That is the whole reason the reporting layer exists.

---

## Naming and `ref()`

**Every action name is globally unique, except where two channels deliberately
expose the same reporting surface.** `dv360_reporting.v_daily` and
`cm360_reporting.v_daily` share a name on purpose — a channel's main Looker
source is always called `v_daily`. Nothing refs a reporting view, so the
ambiguity never has to be resolved. If you ever need to `ref()` one, use the
object form.

Prefixes: `stg_`, `seed_`, `dim_`, `fct_`, `v_`. No version suffixes in names —
git handles versions, which is why `_v5` did not survive the port.

### Source refs are always qualified

Keboola named its raw extracts `fct_dv360_creative_daily`, `fct_dv360_geo_daily`
and so on — the same names our marts use. A bare `ref("fct_dv360_geo_daily")`
is therefore ambiguous between the raw extract in `kebooladv` and the mart in
`dv360_marts`, and Dataform resolves it to whichever it feels like. That is a
silent, self-referential loop, not an error you would notice in a dashboard.

So: **every reference to a source table names its dataset.**

```sqlx
FROM ${ref({ schema: constants.DATASETS.kebooladv, name: "fct_dv360_geo_daily" })}
```

This holds for all sources, not only the colliding ones, so nobody has to
remember which six are dangerous.

**And the same applies in the other direction.** Because those six names are
shared, a bare `ref("fct_dv360_geo_daily")` aimed at the *mart* is just as
ambiguous. Every reference to one of the six — from a reporting view, from an
assertion, from anywhere — names its schema too:

```sqlx
FROM ${ref({ schema: constants.SCHEMAS.dv360_marts, name: "fct_dv360_geo_daily" })}
```

Dataform fails compilation on this rather than guessing, so you find out
immediately. The six names are: `fct_dv360_creative_daily`,
`fct_dv360_geo_daily`, `fct_dv360_inventory_daily`,
`fct_dv360_placement_daily`, `fct_dv360_reach_daily`,
`fct_dv360_timeofday_daily`.

---

## Seeds: two kinds, and they behave differently

Both live in a `_seeds` dataset, and the difference matters.

**Code-defined** (`type: "table"`) — the rows live in this repo and the table is
rebuilt from them on every run. Editing the table in BigQuery achieves nothing;
edit the file.

- `dv360_seeds.seed_metric_catalog`, `seed_dimension_coverage`
- `cm360_seeds.seed_metric`
- `meta_seeds.seed_action_type`, `seed_result_type`

**Hand-maintained** (`type: "operations"` + `CREATE TABLE IF NOT EXISTS`) — the
rows were typed in by a human and a pipeline run must never destroy them.
Dataform creates the table if it is missing and then leaves it alone. Load them
with `INSERT` in the BigQuery console.

- `dv360_seeds.seed_line_item_flight` — booked flight dates
- `cm360_seeds.seed_site` — site names, which exist in no source table
- `core_seeds.seed_client_name_map` — canonical client names across channels

`hasOutput: true` is what makes an operation `ref()`-able. A hand-maintained
seed is empty on day one; every model that reads one falls back gracefully and
reports the gap in `reporting.v_data_gaps`.

### The one piece of JavaScript that earns its place

`includes/meta_actions.js` holds Meta's action-type mapping as a plain array.
Two things need that list and must never disagree: the seed table, and the
`PIVOT ... FOR metric_name IN (...)` column list in `meta_reporting.v_ad_daily`,
which SQL cannot read out of a table. The deployed Weld script solved this with
`DECLARE` + `EXECUTE IMMEDIATE`; Dataform compiles to static SQL, so the list is
generated at compile time instead and the dynamic SQL is gone.

Adding a Meta metric is one row in that array. The seed, the pivot and every
`n_*` / `val_*` column move together.

---

## Running it

Every model carries a channel tag and a layer tag, so any slice is one command.

```
dataform run --tags dv360        # rebuild one channel end to end
dataform run --tags staging      # every channel's staging layer
dataform run --tags seeds        # reference data only
dataform run --tags monitoring   # assertions without rebuilding anything
```

Tags in use: `dv360`, `cm360`, `meta`, `tiktok`, `core` · `staging`, `seeds`,
`marts`, `reporting` · `monitoring`, `freshness`, `docs`.

Dependency order is derived from `ref()`, so a full run needs no orchestration
beyond `dataform run`.

### Assertions vs. data gaps — the distinction that keeps the pipeline honest

An **assertion** turns the workflow red. It is reserved for things that mean a
number is wrong:

| Assertion | Fires when |
|---|---|
| `assert_source_freshness` | a channel stopped delivering |
| `assert_dv360_creative_coverage` | creative spend drops below the known ~85% |
| `assert_cm360_hourly_grain` | the base grain gained duplicate rows |
| `assert_cm360_campaign_reconciliation` | CM360's two reports disagree on impressions |
| `assert_meta_spend_reconciliation` | de-duplication changed the money |
| `assert_meta_alias_leak` | a purchase alias got past the whitelist |
| `assert_meta_results_coverage` | spend exists under an optimization goal with no Results definition |
| `assert_meta_ad_daily_grain` | duplicate or null-keyed rows at Meta's base grain |
| `assert_staging_date_parsing` | a channel's date or hour string stopped parsing |
| `assert_tiktok_ad_coverage` | TikTok ad-level spend drops below the known ~98.6% of campaign-level |
| `assert_tiktok_grain` | TikTok started delivering duplicate rows, so staging now needs de-duplication |

Thresholds live in `workflow_settings.yaml`, not in the SQL.

Two tables carry `requirePartitionFilter` and therefore have **no** `assertions`
block in their config: `fct_meta_ad_daily` and `fct_cm360_placement_hourly`.
Dataform generates those assertions without a date filter, and BigQuery refuses
to run an unfiltered query against such a table. The equivalent checks are
written by hand in `assert_meta_ad_daily_grain` and `assert_cm360_hourly_grain`,
where the filter can go in. If you add `requirePartitionFilter` to another
table, move its assertions out the same way.

**`reporting.v_data_gaps`** is everything else: unmapped sites, unnamed
advertisers, unmapped clients, action types with no seed row, breakdown rows
Weld could not attribute to an ad. These are work items, sized by rows and by
spend so they can be prioritised. They are deliberately *not* assertions — a
seed is empty on day one and a pipeline that is red from the start teaches
everyone to ignore red.

---

## Setup

1. Create the GitHub repo `ums-media-warehouse` and push this tree.
2. GCP Console → Dataform → Create repository, name `ums-media-warehouse`,
   region `europe-west1`.
3. Link it to the GitHub remote (Settings → Connect to a third-party
   repository; the PAT goes in Secret Manager).
4. Create a workspace named `dev-george`, pull from the remote.
5. Grant the Dataform service account BigQuery Data Editor on the target
   datasets, and Data Viewer on `kebooladv` and `facebook_ads_weld`.
6. Compile, read the generated SQL, then run tag by tag: `seeds`, then
   `staging`, then `dv360`, then the rest.
7. Populate the three hand-maintained seeds. Until you do,
   `reporting.v_data_gaps` is your to-do list.

---

## Known data limitations

These are properties of the source data, not bugs in this repo. Each one is
either asserted on or surfaced in `v_data_gaps`.

**DV360**

- Stopped delivering on 2026-08-25. `assert_source_freshness` catches a repeat
  within a day, and as of 2026-09-16 it is still red for this and for CM360.
  Leave it red: the fix is upstream in Keboola, and raising the threshold to
  get a green tick would hide the single most important fact about the data.
- `v_creative_daily` covers ~85% of spend. DV360 omits impressions it cannot
  attribute to a named creative. Use the creative stack to compare creatives,
  never to total money.
- `fct_dv360_inventory_daily` is backed by ONE day of source data. Media Type,
  Device, Environment, Exchange, Inventory Source, Channel and Ad Position exist
  nowhere else, so the table stays in place.
- The geo report has Country only, ~61 rows/month. Directional at best.
- `fct_dv360_floodlight_daily` is empty. `stg_dv360_floodlight` exists with no
  mart and no view behind it on purpose: an empty table on a dashboard reads as
  "zero conversions", not "no data".
- `fct_dv360_youtube_daily` is deliberately not staged. It would be a second
  source of truth for TrueView views.
- Spend is sell-side, advertiser currency. Different from the buy-side numbers
  in `DV360_Actuals`. Never present them as the same metric.

**CM360**

- No source table carries a site *name*. `seed_site` is the only thing standing
  between the dashboards and a wall of numeric IDs.
- `cm360_reach` is the only table with `advertiserId` and the advertiser name on
  the same row. `stg_cm360_advertiser_bridge` depends on that and is fragile by
  design — an advertiser absent from the reach report has no name anywhere.
- `viewable_rate` is **not** CM360's "Active View: % Viewable Impressions". The
  real metric divides by Measurable Impressions, which the Keboola report does
  not deliver, so ours reads lower than the CM360 UI. Add
  `activeViewMeasurableImpressions` to the report to close it.
- Placement Start/End Date are not in the report. `dim_cm360_placement` exposes
  first/last *active* date, derived from delivery. Do not use them for pacing.
- No currency column anywhere. `core` carries `currency = NULL` for CM360.
- **Stopped delivering on 2026-08-31.** Same as DV360, sixteen days later.
- **`media_cost` is not comparable with DV360 or Meta spend — verify before
  anyone sums across channels.** Verified 2026-09-16: CM360 media_cost totals
  2,538 against DV360 68,916 and Meta 36,418 for the same period. That is the
  shape of an ad-serving fee, not media spend. If CM360 is serving impressions
  that were bought in DV360, then adding the two both double counts the
  delivery and mislabels the money. `reporting.v_ad_performance_daily` will
  happily add them, so this needs an answer before it goes on a dashboard.

**Meta**

- Weld lands ~137 tables; 14 are declared and the rest are ignored.
- Meta reports purchases under seven identical aliases. `seed_action_type` keeps
  one; `assert_meta_alias_leak` watches for the others getting through.
- "Results" is not a field. It resolves from the ad set's `optimization_goal`
  via `seed_result_type`. A goal missing from the seed means NULL results for
  real spend, which is why that one *is* an assertion.
- Three of the five breakdowns have no `ad_id`, so those rows cannot be labelled
  below account level. Sized in `v_data_gaps`.

**TikTok**

- **The only channel that is actually live.** Data through today, updating daily,
  46 days of history from 2026-08-03. Meta is current too; DV360 and CM360 are
  not.
- Weld lands 41 tables and **21 of them carry identical metrics** — the same
  money at every hierarchy level, every time grain and every breakdown. Eleven
  are declared; the rest are derivable and would each become a second source of
  truth. The reasons are listed in `declarations.js`.
- **The ad-level report covers ~98.6% of spend.** Verified 2026-09-17:
  191,949.54 at campaign level against 189,210.58 at ad level. So there are two
  facts — `fct_tiktok_campaign_daily` is complete and is what `core` reads;
  `fct_tiktok_ad_daily` is the detail. Same split as DV360's creative gap, just
  smaller.
- **`currency` exists only on the `advertiser` entity.** No report table has one,
  so spend is unlabelled until `dim_tiktok_campaign` or `dim_tiktok_ad` is joined.
- `ad_daily_report` carries only `advertiser_id` and `ad_id` — campaign and ad
  group come from `dim_tiktok_ad`.
- **21 stored ratios** (`cpc`, `cpm`, `ctr`, `cost_per_*`, `*_rate`) are kept as
  `src_*` for audit only and recomputed in reporting, as everywhere else.
- `real_time_*` columns are TikTok's fast-updating estimates and they revise.
  Audit only.
- `skan_*` is iOS SKAdNetwork — a separate, privacy-limited attribution path.
  Never added to `conversion`.
- **Staging deliberately does NOT de-duplicate.** Verified 2026-09-17: rows equal
  distinct grain exactly. `assert_tiktok_grain` watches that assumption instead.
- `platform` is published at campaign level only, so those breakdown rows carry
  no `ad_id`.

**Cross-channel**

- Reach is non-additive in all three channels and is never joined to an
  impression fact. Each channel's reach has its own isolated table and, in
  DV360's case, its own view. Do not blend it with a delivery source in Looker.
- `core.fct_ad_performance_daily` carries a `conversions` column whose meaning
  differs per channel, so every row also carries `conversions_definition`.
  Show them together or not at all.
- Advertiser names do not match across channels. `seed_client_name_map`
  resolves them; until it is populated, `is_client_unmapped` is TRUE and the
  cross-channel report groups a client under each channel's own spelling.

---

## Conventions

- A metric a channel does not measure is `CAST(NULL AS ...)` in the core union,
  never `0`. Zero means measured as zero; NULL means not measured.
- Every branch of a union casts explicitly. Do not rely on BigQuery's supertype
  coercion to line up types.
- Facts are partitioned on `date` and clustered on the columns Looker filters.
  Where `requirePartitionFilter` is on, downstream models filter with
  `${constants.allPartitions()}` rather than an inline literal.
- Marts are internal. Looker Studio connects to reporting views, never to a
  mart and never to staging.
- Names carry no version suffix.
- **No backslashes in `.sqlx` SQL bodies.** How a `.sqlx` body treats escape
  sequences is not worth betting a silently-NULL column on, and we lost a run
  to exactly that. Write `[0-9]` not the `d` shorthand, `[.]` not an escaped
  dot. There are zero backslashes in any `.sqlx` file and it should stay that
  way. Backticks are out for the same reason — that is why `constants.schemaOf()`
  exists rather than an inline `CREATE SCHEMA`.
- Every statement in a `type: "operations"` block ends with a semicolon, and
  multiple statements are separated by `---` on its own line.

---

## What changed in the port from `all_scripts/`

- `CREATE OR REPLACE` everywhere became typed Dataform actions, so dependency
  order comes from `ref()` instead of from the order you run four files in.
- Mart object names gained their channel: `dim_line_item` →
  `dim_dv360_line_item`, `dim_advertiser` → `dim_cm360_advertiser`,
  `fct_placement_daily` → `fct_cm360_placement_daily`, `dim_ad` →
  `dim_meta_ad`, and so on. Reporting view names are unchanged — those are the
  contract with Looker Studio. The old tables left behind by the Weld scripts
  can be dropped once the new ones are verified.
- Meta's reporting view moved from `meta_marts` to `meta_reporting`, so all
  three channels have the same four-layer shape.
- `DECLARE` + `EXECUTE IMMEDIATE` for the Meta pivot is gone, replaced by
  compile-time generation from `includes/meta_actions.js`.
- The two hand-maintained CM360 and DV360 seed tables changed from
  `CREATE OR REPLACE` to `CREATE TABLE IF NOT EXISTS`. The old scripts would
  have wiped hand-entered rows on every run.
- `WELD_Meta_Validation.sql` became four assertions and part of
  `reporting.v_data_gaps`, so the checks run on every build instead of when
  someone remembers.
