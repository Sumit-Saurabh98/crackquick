export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body (e.g. a crash page)
  }
  if (!res.ok) {
    const msg = data && typeof data === "object" && "error" in data ? String(data.error) : "";
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}

export function send<T>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) {
  return api<T>(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
