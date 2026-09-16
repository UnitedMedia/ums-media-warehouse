// Meta action-type mapping. This is DATA, kept in JS for exactly one
// reason: two places need the same list and they must never drift.
//
//   1. seeds/meta/seed_action_type.sqlx builds a queryable table from it
//   2. reporting/meta/v_ad_daily.sqlx needs the metric names as a
//      literal PIVOT column list, which SQL cannot read out of a table
//
// The deployed Weld script solved (2) with DECLARE + EXECUTE IMMEDIATE.
// Dataform compiles to static SQL, so the list is generated here at
// compile time instead. Adding a metric = adding one row below.
//
// is_canonical = true  -> the raw name we report on
// is_canonical = false -> Meta's duplicate alias. Kept so the mapping is
//                         documented, excluded from the mart so
//                         conversions are never double counted.
//
// Proven identical on 2026-09-10: the seven purchase aliases returned
// zero rows from the distinct-value check, so picking one is lossless.
// Re-run that check after adding ad accounts.

// [raw_action_type, metric_name, metric_group, is_canonical, notes]
const ACTION_TYPES = [
  // ---- engagement ---------------------------------------------------
  ["post_engagement",                 "post_engagement",      "engagement", true,  null],
  ["page_engagement",                 "page_engagement",      "engagement", true,  null],
  ["post_reaction",                   "post_reactions",       "engagement", true,  null],
  ["comment",                         "post_comments",        "engagement", true,  null],
  ["post",                            "post_shares",          "engagement", true,  "Meta reports shares under the bare name post"],
  ["onsite_conversion.post_save",     "post_saves",           "engagement", true,  null],
  ["like",                            "facebook_page_likes",  "engagement", true,  "Page-level like. CONFIRM with the business which Facebook likes they mean."],
  ["onsite_conversion.post_net_like", "post_likes_net",       "engagement", true,  "Post-level like, net of unlikes"],
  ["rsvp",                            "event_responses",      "engagement", true,  null],
  ["post_interaction_gross",          "interactions",         "engagement", true,  null],
  ["post_interaction_net",            "interactions_net",     "engagement", true,  null],

  // Negative and net counterparts, found unmapped on 2026-09-16. Each gets
  // its OWN metric — an unlike is not a like with a minus sign, and folding
  // them together would hide the signal people actually want to see.
  ["onsite_conversion.post_unlike",   "post_unlikes",         "engagement", true,  "Negative signal. Never net this off post_likes_net, which is already net."],
  ["onsite_conversion.post_net_save", "post_saves_net",       "engagement", true,  "Saves net of unsaves. post_saves is the gross figure — do not add the two."],
  ["onsite_conversion.post_unsave",   "post_unsaves",         "engagement", true,  "Negative signal."],
  ["onsite_conversion.post_net_comment", "post_comments_net", "engagement", true,  "Comments net of deletions. post_comments is gross — do not add the two."],
  ["post_uncomment",                  "post_uncomments",      "engagement", true,  "Negative signal."],
  ["onsite_conversion.messaging_block","messaging_blocks",    "engagement", true,  "A person blocked the business in Messenger. Strong negative signal, worth watching on its own."],

  // ---- traffic ------------------------------------------------------
  ["link_click",                      "link_clicks",          "traffic",    true,  "Also on the parent table as inline_link_clicks; prefer the parent"],
  ["landing_page_view",               "landing_page_views",   "traffic",    true,  null],
  ["onsite_conversion.engaged_page_view", "engaged_page_views", "traffic",  true,  "Meta's engaged page view. Not the same as a landing page view — do not add the two."],

  // ---- awareness ----------------------------------------------------
  ["video_view",                      "views_3s",             "awareness",  true,  "3-second video views. Not the full video funnel."],

  // ---- leads --------------------------------------------------------
  ["lead",                            "leads",                "leads",      true,  null],

  // ---- ecommerce ----------------------------------------------------
  ["view_content",                    "content_views",        "ecomm",      true,  null],
  ["search",                          "searches",             "ecomm",      true,  null],
  ["add_to_cart",                     "adds_to_cart",         "ecomm",      true,  null],
  ["initiate_checkout",               "checkouts_initiated",  "ecomm",      true,  null],
  ["add_payment_info",                "adds_of_payment_info", "ecomm",      true,  null],
  ["purchase",                        "purchases",            "ecomm",      true,  "Canonical of 7 identical aliases"],

  // ---- calls --------------------------------------------------------
  ["click_to_call_native_call_placed",      "phone_calls_placed",    "calls", true, null],
  ["click_to_call_call_confirm",            "phone_calls_confirmed", "calls", true, null],
  ["click_to_call_native_20s_call_connect", "calls_connected_20s",   "calls", true, null],
  ["click_to_call_native_60s_call_connect", "calls_connected_60s",   "calls", true, null],

  // ---- aliases: excluded from the mart, kept for documentation -------
  ["omni_purchase",                                 "purchases",            "ecomm",   false, "alias"],
  ["onsite_web_purchase",                           "purchases",            "ecomm",   false, "alias"],
  ["onsite_web_app_purchase",                       "purchases",            "ecomm",   false, "alias"],
  ["web_in_store_purchase",                         "purchases",            "ecomm",   false, "alias"],
  ["web_app_in_store_purchase",                     "purchases",            "ecomm",   false, "alias"],
  ["offsite_conversion.fb_pixel_purchase",          "purchases",            "ecomm",   false, "alias"],
  ["omni_view_content",                             "content_views",        "ecomm",   false, "alias"],
  ["onsite_web_view_content",                       "content_views",        "ecomm",   false, "alias"],
  ["onsite_web_app_view_content",                   "content_views",        "ecomm",   false, "alias"],
  ["offsite_conversion.fb_pixel_view_content",      "content_views",        "ecomm",   false, "alias"],
  ["omni_add_to_cart",                              "adds_to_cart",         "ecomm",   false, "alias"],
  ["onsite_web_add_to_cart",                        "adds_to_cart",         "ecomm",   false, "alias"],
  ["onsite_web_app_add_to_cart",                    "adds_to_cart",         "ecomm",   false, "alias"],
  ["offsite_conversion.fb_pixel_add_to_cart",       "adds_to_cart",         "ecomm",   false, "alias"],
  ["omni_initiated_checkout",                       "checkouts_initiated",  "ecomm",   false, "alias"],
  ["onsite_web_initiate_checkout",                  "checkouts_initiated",  "ecomm",   false, "alias"],
  ["offsite_conversion.fb_pixel_initiate_checkout", "checkouts_initiated",  "ecomm",   false, "alias"],
  ["offsite_conversion.fb_pixel_add_payment_info",  "adds_of_payment_info", "ecomm",   false, "alias"],
  ["omni_search",                                   "searches",             "ecomm",   false, "alias"],
  ["offsite_conversion.fb_pixel_search",            "searches",             "ecomm",   false, "alias"],
  ["omni_landing_page_view",                        "landing_page_views",   "traffic", false, "alias"],
  ["onsite_web_lead",                               "leads",                "leads",   false, "alias"],
  ["offsite_conversion.fb_pixel_lead",              "leads",                "leads",   false, "alias"],
  ["call_confirm_grouped",                          "phone_calls_confirmed","calls",   false, "alias"],

  // ---- client-specific: never merge into the standard events --------
  ["offsite_purchase_add_20_s_calls",              "purchases_incl_20s_calls",      "client_custom", true, "One account counts a 20s phone call as a purchase"],
  ["offsite_add_to_cart_add_20_s_calls",           "adds_to_cart_incl_20s_calls",   "client_custom", true, null],
  ["offsite_content_view_add_20_s_calls",          "content_views_incl_20s_calls",  "client_custom", true, null],
  ["offsite_initiate_checkout_add_20_s_calls",     "checkouts_incl_20s_calls",      "client_custom", true, null],
  ["offsite_lead_add_20_s_calls",                  "leads_incl_20s_calls",          "client_custom", true, null],
  ["offsite_complete_registration_add_20_s_calls", "registrations_incl_20s_calls",  "client_custom", true, null],
  ["offsite_content_view_add_meta_leads",          "content_views_incl_meta_leads", "client_custom", true, null],
  ["offsite_search_add_meta_leads",                "searches_incl_meta_leads",      "client_custom", true, null],
  ["grouped_pixel_custom_conversions_add_20_s_calls", "custom_pixel_conversions_incl_20s_calls", "client_custom", true, null],
  ["custom_event_actions_add_20_s_calls",             "custom_events_incl_20s_calls",            "client_custom", true, null],

  // Meta's ROLL-UP of every custom pixel conversion on an ad. Kept visible
  // and named "_all" rather than dropped, because dropping it would make 7
  // real conversions vanish with no trace. But it OVERLAPS with the
  // individually-named custom conversions resolved from
  // offsite_conversion.custom.<id> — never add n_custom_pixel_conversions_all
  // to those, or you count the same event twice.
  ["offsite_conversion.fb_pixel_custom", "custom_pixel_conversions_all", "client_custom", true, "ROLL-UP. Overlaps with the named custom conversions. Report one or the other, never the sum."],
];

// Meta's "Results" is not a field. It resolves from the ad set's
// optimization_goal. Extend as new goals appear — anything missing here
// shows up in assert_meta_results_coverage.
// [optimization_goal, result_metric_name, notes]
const RESULT_TYPES = [
  ["LINK_CLICKS",         "link_clicks",         null],
  ["LANDING_PAGE_VIEWS",  "landing_page_views",  null],
  ["LEAD_GENERATION",     "leads",               null],
  ["QUALITY_LEAD",        "leads",               null],
  ["POST_ENGAGEMENT",     "post_engagement",     null],
  ["PAGE_LIKES",          "facebook_page_likes", null],
  ["THRUPLAY",            "views_3s",            "Approximation. True ThruPlay is not synced at ad level."],
  ["VIDEO_VIEWS",         "views_3s",            null],
  ["APP_INSTALLS",        "app_installs",        "Metric not present in current data"],
  ["OFFSITE_CONVERSIONS", "purchases",           "DEFAULT ONLY. Real value depends on the pixel event per campaign."],
  ["VALUE",               "purchases",           null],
  ["REACH",               "reach",               "Comes from the fact table, not from actions"],
  ["IMPRESSIONS",         "impressions",         "Comes from the fact table, not from actions"],
  ["EVENT_RESPONSES",     "event_responses",     "Found spending in Sep 2026 with no mapping. Clean match: the goal and the rsvp action are the same thing."],
  ["QUALITY_CALL",        "calls_connected_60s", "UNCONFIRMED. Found spending in Sep 2026 with no mapping. Meta's quality-call optimisation counts calls past a duration threshold, and 60s is the longest we collect — but the real threshold is set per ad set. CONFIRM with the account team; if it is wrong, cost_per_result is wrong for this goal and nothing else."],
];

// --- tiny SQL emitters -----------------------------------------------

function lit(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

// Turns the arrays above into the body of a VALUES / UNNEST-free
// SELECT ... UNION ALL free literal list: "  ('a', 'b'),\n  ('c', 'd')"
function rowsToValues(rows) {
  return rows.map(r => "  (" + r.map(lit).join(", ") + ")").join(",\n");
}

// Distinct canonical metric names, sorted. This is the PIVOT column
// list, and therefore the exact set of n_* / val_* columns that
// v_ad_daily exposes to Looker Studio.
function canonicalMetricNames() {
  const seen = [];
  ACTION_TYPES.forEach(r => {
    if (r[3] && seen.indexOf(r[1]) === -1) seen.push(r[1]);
  });
  return seen.sort();
}

// -> "'leads' AS leads, 'purchases' AS purchases, ..."
// The alias is what names the pivoted columns n_leads / val_leads.
function pivotColumnList() {
  return canonicalMetricNames().map(m => "'" + m + "' AS " + m).join(", ");
}

module.exports = {
  ACTION_TYPES, RESULT_TYPES,
  rowsToValues, canonicalMetricNames, pivotColumnList,
};
