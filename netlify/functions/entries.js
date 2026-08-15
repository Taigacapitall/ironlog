import { getStore } from "@netlify/blobs";

const STORE_NAME = "ironlog";
const KEY = "entries";

// Strong consistency so a write is immediately visible to the next read —
// important here since the client re-fetches right after logging a set.
function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

export default async (req) => {
  const s = store();

  if (req.method === "GET") {
    const entries = (await s.get(KEY, { type: "json" })) || [];
    return Response.json(entries);
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { exercise, sets, reps, weight, unit, date, time } = body || {};
    if (!exercise || !sets || !reps || !date || !time) {
      return new Response("Missing required fields", { status: 400 });
    }

    const entries = (await s.get(KEY, { type: "json" })) || [];
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      exercise: String(exercise),
      sets: String(sets),
      reps: String(reps),
      weight: weight || null,
      unit: unit || "kg",
      date: String(date),
      time: String(time),
    };
    entries.push(entry);
    await s.setJSON(KEY, entries);
    return Response.json(entries, { status: 201 });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const entries = (await s.get(KEY, { type: "json" })) || [];
    const next = entries.filter((e) => e.id !== id);
    await s.setJSON(KEY, next);
    return Response.json(next);
  }

  return new Response("Method not allowed", { status: 405 });
};
