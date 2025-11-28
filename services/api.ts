const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export async function generateText(prompt: string) {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`Backend error ${res.status}: ${msg}`);
  }

  return res.json() as Promise<{ text: string }>;
}

