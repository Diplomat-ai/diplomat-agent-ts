import pRetry from "p-retry";

export async function fetchWithRetry(url: string, data: unknown) {
  return pRetry(
    () =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    { retries: 3 }
  );
}
