import type { FeedView } from "./queries";

// Tracker row 60: members asked what "Active" means on Home. One plain
// sentence under the tabs says what the selected tab holds. The expiry
// periods come from Admin -> Policy, so the copy stays true if the council
// changes them.
export function viewHint(
  view: FeedView,
  opportunityDays: number,
  jobDays: number,
): string {
  switch (view) {
    case "active": {
      const period =
        opportunityDays === jobDays
          ? `${opportunityDays} days`
          : `${opportunityDays} days (jobs: ${jobDays} days)`;
      return `Active shows current posts from the network. Business opportunities and jobs stay here for ${period} after posting, then move to Expired. Knowledge posts and events stay here.`;
    }
    case "tagged":
      return "Posts where a member tagged you as relevant.";
    case "old":
      return "Business opportunities and jobs past their expiry date.";
    case "mine":
      return "Everything you have posted.";
  }
}
