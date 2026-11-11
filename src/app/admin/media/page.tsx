import { AdminHeader } from "@/components/admin/page-header";
import { MediaBrowser } from "@/components/cms/media-browser";
import { requireCan } from "@/lib/session";

export const metadata = { title: "Media" };

export default async function AdminMedia() {
  await requireCan("manageMedia", "/admin/media");
  return (
    <>
      <AdminHeader title="Media library" description="Every image uploaded to MedTeds. Drag images onto this page to upload them." />
      <MediaBrowser mode="page" />
    </>
  );
}
