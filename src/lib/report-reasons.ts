export const REPORT_REASONS = ["spam", "harassment", "misinformation", "hateful", "explicit", "copyright", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  harassment: "Harassment or bullying",
  misinformation: "Harmful health misinformation",
  hateful: "Hateful content",
  explicit: "Explicit or violent content",
  copyright: "Copyright or plagiarism",
  other: "Something else",
};
