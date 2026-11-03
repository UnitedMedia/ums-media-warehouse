-- ---------------------------------------------------------------------
-- CM360 warehouse vs CM360 UI
--
-- Set the four values below from a CM360 Overview screen, run it, and
-- read the last two columns. Nothing here writes anything.
--
-- WHY THIS EXISTS: CM360 publishes three reports that agree on
-- impressions and disagree about CLICKS by 3x, because it cannot
-- attribute a click below campaign level. The warehouse used to read
-- the finest one and undercounted clicks by about 65%. Since 2026-11-03
-- it reads the campaign-level report. This script is how you confirm
-- that for any advertiser instead of taking it on trust.
--
-- Verified 2026-11-03 on ALLIANZ ASIGURARI, 10-31 Oct:
--   UI         11,017,101 impressions   49,256 clicks   0.45%
--   warehouse  11,017,422               49,256          0.447%
-- Clicks exact; impressions 0.003% apart, which is a date-boundary
-- artefact and not worth chasing.
-- ---------------------------------------------------------------------

DECLARE advertiser_cautat STRING DEFAULT '%ALLIANZ%';   -- UPPER, with %
DECLARE de_la            DATE   DEFAULT DATE '2026-10-10';
DECLARE pana_la          DATE   DEFAULT DATE '2026-10-31';

-- type these two from the CM360 screen
DECLARE ui_impresii      INT64  DEFAULT 11017101;
DECLARE ui_clicks        INT64  DEFAULT 49256;

WITH
-- what we report
noi AS (
  SELECT
    SUM(impressions) AS impresii,
    SUM(clicks)      AS clicks
  FROM `ums-digital-core-automation.reporting.v_ad_performance_daily`
  WHERE channel = 'CM360'
    AND date BETWEEN de_la AND pana_la
    AND UPPER(advertiser_raw_name) LIKE advertiser_cautat
),

-- the campaigns involved, so the old source can be compared like for like
camp AS (
  SELECT campaign_id
  FROM `ums-digital-core-automation.cm360_marts.dim_cm360_campaign`
  WHERE UPPER(advertiser_name) LIKE advertiser_cautat
    AND NOT COALESCE(is_dv360_passthrough, FALSE)
),

-- what the placement-level report would have said (the old behaviour)
vechi AS (
  SELECT
    SUM(impressions) AS impresii,
    SUM(clicks)      AS clicks
  FROM `ums-digital-core-automation.cm360_staging.stg_cm360_hourly`
  WHERE date BETWEEN de_la AND pana_la
    AND campaign_id IN (SELECT campaign_id FROM camp)
)

SELECT 1 AS nr, 'UI CM360 (introdus manual)' AS sursa,
       ui_impresii AS impresii, ui_clicks AS clicks,
       ROUND(SAFE_DIVIDE(ui_clicks, ui_impresii)*100, 3) AS ctr_pct,
       CAST(NULL AS STRING) AS fata_de_ui
UNION ALL
SELECT 2, 'Warehouse — ce raportam acum',
       noi.impresii, noi.clicks,
       ROUND(SAFE_DIVIDE(noi.clicks, noi.impresii)*100, 3),
       FORMAT('clicks %+d (%+.2f%%), impresii %+d (%+.3f%%)',
              noi.clicks - ui_clicks,
              SAFE_DIVIDE(noi.clicks - ui_clicks, ui_clicks)*100,
              noi.impresii - ui_impresii,
              SAFE_DIVIDE(noi.impresii - ui_impresii, ui_impresii)*100)
FROM noi
UNION ALL
SELECT 3, 'Warehouse — inainte (raportul orar)',
       vechi.impresii, vechi.clicks,
       ROUND(SAFE_DIVIDE(vechi.clicks, vechi.impresii)*100, 3),
       FORMAT('clicks %+d (%+.2f%%)',
              vechi.clicks - ui_clicks,
              SAFE_DIVIDE(vechi.clicks - ui_clicks, ui_clicks)*100)
FROM vechi
ORDER BY nr;

-- Row 2 should read clicks +0. Impressions within a few hundred is fine.
-- Row 3 is there to show how far off it used to be.
--
-- IF ROW 2 IS NOT ZERO ON CLICKS:
--   * check the UI filter was Advertiser only, with Campaign/Site/
--     Activity on All — any other filter changes the number
--   * check the dates match exactly, inclusive on both ends
--   * if it is still off, the campaign report may not be authoritative
--     for this advertiser and we need to look again
