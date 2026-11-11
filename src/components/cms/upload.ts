export async function uploadImage(file: File): Promise<{ url: string } | { error: string }> {
  if (file.size > 5 * 1024 * 1024) return { error: "Images can be up to 5 MB." };
  const body = new FormData();
  body.append("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Upload failed. Try again." };
    return { url: data.url };
  } catch {
    return { error: "Upload failed. Check your connection and try again." };
  }
}
