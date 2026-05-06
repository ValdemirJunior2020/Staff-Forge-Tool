// client/src/lib/api.ts

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`);

    if (!response.ok) {
      console.warn("API GET failed:", await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.warn("API GET unavailable:", error);
    return null;
  }
}

export async function apiPost<T>(
  path: string,
  body: unknown
): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn("API POST failed:", await response.text());
      return null;
    }

    return response.json();
  } catch (error) {
    console.warn("API POST unavailable:", error);
    return null;
  }
}