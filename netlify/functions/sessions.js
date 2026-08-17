import { getStore } from "@netlify/blobs";

function store() {
  return getStore({ name: "ironlog", consistency: "strong" });
}

const SESSIONS_KEY = "sessions";
const LEGACY_KEY = "entries"; // old flat-entry format from the previous version

// One-time conversion of the old flat entries (exercise, sets, reps, weight,
// unit, date, time, type, duration) into the new session/exercise/set shape.
// Entries sharing the same date+time are assumed to belong to the same session.
function migrateLegacy(legacyEntries) {
  const byKey = {};
  for (const e of legacyEntries) {
    const key = `${e.date}T${e.time}`;
    if (!byKey[key]) {
      byKey[key] = {
        id: "legacy-" + key.replace(/[^0-9]/g, ""),
        date: e.date,
        time: e.time,
        name: "",
        duration: e.duration ? Number(e.duration) : null,
        exercises: [],
      };
    }
    const session = byKey[key];
    const setCount = parseInt(e.sets, 10) || 1;
    const repParts = String(e.reps || "").split(",").map((s) => s.trim()).filter(Boolean);
    const weight = e.weight ? Number(e.weight) : null;
    const unit = e.unit || "kg";
    let sets = [];
    if (repParts.length > 1) {
      sets = repParts.map((r) => ({ reps: parseInt(r, 10) || 0, weight, unit }));
    } else {
      const singleReps = parseInt(repParts[0], 10) || 0;
      for (let i = 0; i < setCount; i++) sets.push({ reps: singleReps, weight, unit });
    }
    session.exercises.push({
      name: e.exercise,
      type: e.type === "calisthenics" ? "calisthenics" : "musculation",
      sets,
    });
  }
  return Object.values(byKey);
}

export default async (req) => {
  const s = store();

  if (req.method === "GET") {
    let sessions = await s.get(SESSIONS_KEY, { type: "json" });
    if (!sessions) {
      const legacy = await s.get(LEGACY_KEY, { type: "json" });
      sessions = legacy && legacy.length ? migrateLegacy(legacy) : [];
      await s.setJSON(SESSIONS_KEY, sessions);
    }
    return Response.json(sessions);
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response("Invalid JSON body", { status: 400 });
    }

    const { date, time, name, duration, exercises } = body || {};
    if (!date || !time || !Array.isArray(exercises) || exercises.length === 0) {
      return new Response("Missing required fields", { status: 400 });
    }
    for (const ex of exercises) {
      if (!ex.name || !Array.isArray(ex.sets) || ex.sets.length === 0) {
        return new Response("Each exercise needs a name and at least one set", { status: 400 });
      }
    }

    const sessions = (await s.get(SESSIONS_KEY, { type: "json" })) || [];
    const session = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      date: String(date),
      time: String(time),
      name: name ? String(name) : "",
      duration: duration ? Number(duration) : null,
      exercises: exercises.map((ex) => ({
        name: String(ex.name),
        type: ex.type === "calisthenics" ? "calisthenics" : "musculation",
        sets: ex.sets.map((st) => ({
          reps: Number(st.reps) || 0,
          weight: st.weight !== undefined && st.weight !== null && st.weight !== "" ? Number(st.weight) : null,
          unit: st.unit || "kg",
        })),
      })),
    };
    sessions.push(session);
    await s.setJSON(SESSIONS_KEY, sessions);
    return Response.json(sessions, { status: 201 });
  }

  if (req.method === "DELETE") {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return new Response(
        "Server misconfigured: set ADMIN_PASSWORD in Netlify environment variables to enable deletion.",
        { status: 500 }
      );
    }
    const providedPassword = req.headers.get("x-admin-password");
    if (providedPassword !== adminPassword) {
      return new Response("Incorrect password", { status: 401 });
    }
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response("Missing id", { status: 400 });

    const sessions = (await s.get(SESSIONS_KEY, { type: "json" })) || [];
    const next = sessions.filter((sess) => sess.id !== id);
    await s.setJSON(SESSIONS_KEY, next);
    return Response.json(next);
  }

  return new Response("Method not allowed", { status: 405 });
};
