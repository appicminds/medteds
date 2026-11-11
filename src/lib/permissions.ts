/**
 * Roles and what each one may do, modelled on WordPress.
 * Pure functions, so both server code and client components can use them.
 */
export const ROLES = ["subscriber", "contributor", "author", "editor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_INFO: Record<Role, { label: string; description: string }> = {
  subscriber: { label: "Subscriber", description: "Reads, claps, responds, saves and follows." },
  contributor: { label: "Contributor", description: "Writes drafts and submits them for review." },
  author: { label: "Author", description: "Writes and publishes their own stories." },
  editor: { label: "Editor", description: "Manages everyone's stories, pages, media, topics, SEO and responses." },
  admin: { label: "Administrator", description: "Everything, including members, menus and site settings." },
};

const RANK: Record<Role, number> = { subscriber: 0, contributor: 1, author: 2, editor: 3, admin: 4 };

export function asRole(role: string | null | undefined): Role {
  if (role && role in RANK) return role as Role;
  return role === "user" ? "author" : "subscriber"; // "user" was the pre-roles default
}

export type Action =
  | "write" // create and edit own drafts
  | "upload" // upload images
  | "publish" // publish own stories without review
  | "viewAdmin" // open the admin area
  | "editOthersPosts"
  | "moderateComments"
  | "manageTopics"
  | "manageMedia"
  | "managePages"
  | "manageSeo" // search titles, descriptions and sharing for every story, page and topic
  | "manageUsers"
  | "manageMenus"
  | "manageSettings";

const MIN_ROLE: Record<Action, Role> = {
  write: "contributor",
  upload: "contributor",
  publish: "author",
  viewAdmin: "editor",
  editOthersPosts: "editor",
  moderateComments: "editor",
  manageTopics: "editor",
  manageMedia: "editor",
  managePages: "editor",
  manageSeo: "editor",
  manageUsers: "admin",
  manageMenus: "admin",
  manageSettings: "admin",
};

type Who = { id: string; role: string } | null | undefined;

export function can(user: Who, action: Action): boolean {
  if (!user) return false;
  return RANK[asRole(user.role)] >= RANK[MIN_ROLE[action]];
}

/** Whether `user` may edit this story. Contributors can't touch a story once it's live. */
export function canEditPost(user: Who, post: { authorId: string; status: string }): boolean {
  if (!user) return false;
  if (can(user, "editOthersPosts")) return true;
  if (post.authorId !== user.id || !can(user, "write")) return false;
  if (!can(user, "publish") && (post.status === "published" || post.status === "scheduled")) return false;
  return true;
}
