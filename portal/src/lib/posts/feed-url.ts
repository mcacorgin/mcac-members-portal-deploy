import type { FeedView } from "./queries";
import { POST_TYPE_NAMES, type PostTypeName } from "./types";
import {
  OPPORTUNITY_MANDATE_TYPES,
  type OpportunityMandateType,
} from "./opportunity";

// Reads and writes the HOME-01 feed URL. Pure, so the rules that keep older
// links working can be tested without a database.
//
// Two older link shapes are still accepted:
//  - ?view=old. Expired posts keep the stored status "old", but the tab now
//    reads "Expired" and its links say ?view=expired. Both open the tab.
//  - Opportunity filters (mandateType, industry, geography) without a type.
//    The filters now show only on the Business Opportunities tab. On All they
//    already narrowed the feed to opportunities, so such a link is sent to
//    that tab, where the member sees the same posts and the filters that
//    narrow them. On any other type the filters are dropped, so a feed is
//    never narrowed by a filter the member cannot see or clear.

type SearchParams = Record<string, string | string[] | undefined>;

export type FeedParams = {
  view: FeedView;
  type?: PostTypeName;
  q?: string;
  mandateType?: OpportunityMandateType;
  industry?: string;
  geography?: string;
  page?: number;
};

const VIEW_PARAMS: Record<FeedView, string> = {
  active: "active",
  tagged: "tagged",
  old: "expired",
  mine: "mine",
};

// Accepted ?view= values. "old" is the value links used before the rename.
const VIEW_ALIASES = new Map<string, FeedView>([
  ["active", "active"],
  ["tagged", "tagged"],
  ["expired", "old"],
  ["old", "old"],
  ["mine", "mine"],
]);

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function feedHref(params: FeedParams): string {
  const search = new URLSearchParams();
  if (params.view !== "active") search.set("view", VIEW_PARAMS[params.view]);
  if (params.type) search.set("type", params.type);
  if (params.q) search.set("q", params.q);
  if (params.mandateType) search.set("mandateType", params.mandateType);
  if (params.industry) search.set("industry", params.industry);
  if (params.geography) search.set("geography", params.geography);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/home?${qs}` : "/home";
}

/** The ?view= value that `feedHref` writes for a view. */
export function feedViewParam(view: FeedView): string {
  return VIEW_PARAMS[view];
}

/**
 * Reads the feed state from the page's search params. When the URL is an
 * older shape that now lives at another address, `redirectTo` holds that
 * address and the page should redirect before querying.
 */
export function readFeedParams(sp: SearchParams): {
  params: FeedParams & { page: number };
  redirectTo?: string;
} {
  const view = VIEW_ALIASES.get(first(sp.view) ?? "") ?? "active";
  const typeRaw = first(sp.type);
  const type = POST_TYPE_NAMES.includes(typeRaw as PostTypeName)
    ? (typeRaw as PostTypeName)
    : undefined;
  const q = first(sp.q)?.trim().slice(0, 200) || undefined;
  const mandateRaw = first(sp.mandateType);
  const mandateType = OPPORTUNITY_MANDATE_TYPES.includes(
    mandateRaw as OpportunityMandateType,
  )
    ? (mandateRaw as OpportunityMandateType)
    : undefined;
  const industry = first(sp.industry)?.trim().slice(0, 160) || undefined;
  const geography = first(sp.geography)?.trim().slice(0, 160) || undefined;
  const page = Math.max(1, Number.parseInt(first(sp.page) ?? "1", 10) || 1);

  if (!type && (mandateType || industry || geography)) {
    const params = {
      view,
      type: "opportunity" as const,
      q,
      mandateType,
      industry,
      geography,
      page: 1,
    };
    return { params, redirectTo: feedHref(params) };
  }

  if (type !== "opportunity") {
    return { params: { view, type, q, page } };
  }
  return { params: { view, type, q, mandateType, industry, geography, page } };
}
