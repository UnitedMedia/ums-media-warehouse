-- Warehouse health check. Every row should read OK.
-- Nothing here writes. Safe to run any time.
WITH

-- 1. DV360 media must not be counted twice in the cross-channel fact
c1 AS (
  SELECT COUNT(*) AS n FROM `ums-digital-core-automation.reporting.v_ad_performance_daily`
  WHERE channel='CM360'
    AND (STARTS_WITH(campaign_name,'BidManager_')
      OR STARTS_WITH(advertiser_raw_name,'BidManager_'))
),

-- 2. CM360 clicks in core must equal the campaign report minus passthrough
c2 AS (
  SELECT
    (SELECT SUM(clicks) FROM `ums-digital-core-automation.reporting.v_ad_performance_daily`
     WHERE channel='CM360' AND date >= DATE '2026-10-01') AS core_clicks,
    (SELECT SUM(f.clicks_check)
     FROM `ums-digital-core-automation.cm360_marts.fct_cm360_reach_daily` f
     LEFT JOIN `ums-digital-core-automation.cm360_marts.dim_cm360_campaign` d USING (campaign_id)
     WHERE f.date >= DATE '2026-10-01'
       AND NOT COALESCE(d.is_dv360_passthrough, FALSE)) AS sursa_clicks
),

-- 3. Rebuilt marts must agree with their staging (no ignored restatements)
c3 AS (
  SELECT
    (SELECT SUM(clicks) FROM `ums-digital-core-automation.cm360_staging.stg_cm360_hourly` WHERE date IS NOT NULL)
    - (SELECT SUM(clicks) FROM `ums-digital-core-automation.cm360_marts.fct_cm360_placement_hourly` WHERE date > DATE '2000-01-01') AS d_cm_hourly,
    (SELECT SUM(clicks) FROM `ums-digital-core-automation.cm360_staging.stg_cm360_reach` WHERE date IS NOT NULL)
    - (SELECT SUM(clicks_check) FROM `ums-digital-core-automation.cm360_marts.fct_cm360_reach_daily` WHERE date > DATE '2000-01-01') AS d_cm_reach,
    (SELECT SUM(unique_reach) FROM `ums-digital-core-automation.dv360_staging.stg_dv360_reach` WHERE date IS NOT NULL)
    - (SELECT SUM(unique_reach) FROM `ums-digital-core-automation.dv360_marts.fct_dv360_reach_daily` WHERE date > DATE '2000-01-01') AS d_dv_reach
),

-- 4. The marts still append-only: have they started drifting again?
c4 AS (
  SELECT
    (SELECT SUM(impressions) FROM `ums-digital-core-automation.dv360_staging.stg_dv360_inventory` WHERE date IS NOT NULL)
    - (SELECT SUM(impressions) FROM `ums-digital-core-automation.dv360_marts.fct_dv360_inventory_daily`) AS d_inv,
    (SELECT SUM(impressions) FROM `ums-digital-core-automation.dv360_staging.stg_dv360_lineitem` WHERE date IS NOT NULL)
    - (SELECT SUM(impressions) FROM `ums-digital-core-automation.dv360_marts.fct_dv360_daily`) AS d_li
),

-- 5. One row per date + channel + campaign + currency
c5 AS (
  SELECT COUNT(*) AS n FROM (
    SELECT 1 FROM `ums-digital-core-automation.core.fct_ad_performance_daily`
    GROUP BY date, channel, campaign_id, currency HAVING COUNT(*) > 1)
),

-- 6. Every channel present and carrying spend
c6 AS (SELECT COUNT(DISTINCT channel) AS n FROM `ums-digital-core-automation.reporting.v_ad_performance_daily` WHERE spend > 0),

-- 7. Keboola windows wide enough for the full-rebuild marts
c7 AS (
  SELECT LEAST(
    (SELECT COUNT(DISTINCT date) FROM `ums-digital-core-automation.cm360_staging.stg_cm360_hourly` WHERE date IS NOT NULL),
    (SELECT COUNT(DISTINCT date) FROM `ums-digital-core-automation.cm360_staging.stg_cm360_reach`  WHERE date IS NOT NULL),
    (SELECT COUNT(DISTINCT date) FROM `ums-digital-core-automation.dv360_staging.stg_dv360_reach`  WHERE date IS NOT NULL)) AS min_zile
),

-- 8. Stale feeds
c8 AS (SELECT COUNT(*) AS n FROM `ums-digital-core-automation.reporting.v_source_freshness` WHERE is_stale),

-- 9. Teads source de-duplication still holding
c9 AS (
  SELECT COUNT(*) - COUNT(DISTINCT FORMAT('%t|%t|%t|%t|%t|%t', day, seat_id, advertiser_id, campaign_id, line_item_id, creative_id)) AS n
  FROM `ums-digital-core-automation.keboola_teads.teads_daily`
)

SELECT 1 AS nr, 'BidManager exclus din core'        AS verificare, IF(n=0,'OK','PROBLEM') AS stare, CAST(n AS STRING) AS detaliu FROM c1
UNION ALL SELECT 2, 'CM360 clicks = sursa',          IF(core_clicks=sursa_clicks,'OK','PROBLEM'), FORMAT('core %d / sursa %d', core_clicks, sursa_clicks) FROM c2
UNION ALL SELECT 3, 'Marturi reconstruite = staging',IF(d_cm_hourly=0 AND d_cm_reach=0 AND d_dv_reach=0,'OK','PROBLEM'), FORMAT('cm_hourly %d, cm_reach %d, dv_reach %d', d_cm_hourly, d_cm_reach, d_dv_reach) FROM c3
UNION ALL SELECT 4, 'Marturi append-only: drift',    IF(d_inv=0 AND d_li=0,'OK','ATENTIE'), FORMAT('inventory %d, lineitem %d', d_inv, d_li) FROM c4
UNION ALL SELECT 5, 'Fara duplicate in core',        IF(n=0,'OK','PROBLEM'), CAST(n AS STRING) FROM c5
UNION ALL SELECT 6, 'Canale cu spend',               IF(n=6,'OK','ATENTIE'), FORMAT('%d din 6', n) FROM c6
UNION ALL SELECT 7, 'Fereastra Keboola >= 7 zile',   IF(min_zile>=7,'OK','PROBLEM'), FORMAT('minim %d zile', min_zile) FROM c7
UNION ALL SELECT 8, 'Feeduri vechi',                 IF(n=0,'OK','ATENTIE'), FORMAT('%d feeduri', n) FROM c8
UNION ALL SELECT 9, 'Teads fara duplicate',          IF(n=0,'OK','ATENTIE'), FORMAT('%d randuri in plus', n) FROM c9
ORDER BY nr
