/** Reads an image's pixel size in the browser (best effort). */
function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

export async function uploadImage(
  file: File,
  opts: { purpose?: "avatar" } = {},
): Promise<{ id: string; url: string } | { error: string }> {
  if (file.size > 5 * 1024 * 1024) return { error: "Images can be up to 5 MB." };
  const body = new FormData();
  body.append("file", file);
  const size = await imageSize(file);
  if (size) {
    body.append("width", String(size.width));
    body.append("height", String(size.height));
  }
  try {
    const res = await fetch(`/api/upload${opts.purpose ? `?purpose=${opts.purpose}` : ""}`, { method: "POST", body });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Upload failed. Try again." };
    return { id: data.id, url: data.url };
  } catch {
    return { error: "Upload failed. Check your connection and try again." };
  }
}
