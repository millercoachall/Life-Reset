import { z } from "zod";

// AI features: brain-dump sort, Life Rescue, Reset My Day.
// The AI only PROPOSES. The client confirms before anything is saved or moved.
// Production provider: OpenAI (OPENAI_API_KEY env). Model: gpt-4o-mini.
// Local testing without a key: MOCK_AI=1 returns deterministic heuristic proposals.

const CATEGORIES = ["home", "money", "family", "myself", "pending", "general"] as const;
const PRIORITIES = ["high", "medium", "low"] as const;

export const SortSuggestionSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  estMinutes: z.number().int().min(1).max(1440).nullable(),
  waitingOn: z.string().max(200).nullable(),
});
export const SortResultSchema = z.object({
  suggestions: z.array(SortSuggestionSchema).min(1).max(50),
});

export const RescuePlanSchema = z.object({
  firstStep: z.object({ title: z.string().min(1), minutes: z.number().int().min(1) }),
  steps: z.array(z.object({ title: z.string().min(1), minutes: z.number().int().min(1) })),
  canWait: z.array(z.object({ title: z.string().min(1) })),
  closingLine: z.string().min(1),
});

export const DayResetSchema = z.object({
  keep: z.array(z.object({ id: z.number().int(), reason: z.string() })),
  move: z.array(z.object({ id: z.number().int(), reason: z.string() })),
  note: z.string(),
});

export type TaskInput = {
  id: number;
  title: string;
  category: string;
  priority: string;
  estMinutes: number | null;
  dueDate: string | null;
  waitingOn: string | null;
};

function useMock(): boolean {
  return process.env.MOCK_AI === "1";
}

async function callOpenAI<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error(
      "AI is not set up on this server yet. Add an OpenAI API key to enable smart sorting and rescue plans."
    );
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}). ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned an empty response.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI returned a response that could not be read.");
  }
  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    throw new Error("AI returned a response in an unexpected shape.");
  }
  return validated.data;
}

const SORT_SYSTEM = `You sort a family's raw brain dump into clear, doable tasks. Be practical and kind, never scolding. Return JSON only: {"suggestions": [{"title": string, "category": "home"|"money"|"family"|"myself"|"pending"|"general", "priority": "high"|"medium"|"low", "estMinutes": number|null, "waitingOn": string|null}]}. Rules: one task per idea; short titles (under 12 words); category is where the task belongs; priority high only when there is a real deadline or consequence; estMinutes is a realistic guess (5, 10, 15, 20, 30, 45, 60) or null; waitingOn names the person or thing the task is waiting on, or null. If an item is clearly waiting on someone else, use category "pending" and set waitingOn.`;

const RESCUE_SYSTEM = `You make a short, calm rescue plan for an overwhelmed person. Be compassionate, direct, and nonjudgmental — never make them feel behind. Return JSON only: {"firstStep": {"title": string, "minutes": number}, "steps": [{"title": string, "minutes": number}], "canWait": [{"title": string}], "closingLine": string}. Rules: the plan must fit inside the minutes available; the first step must be the single smallest doable thing (5 minutes or less when possible); use only the open tasks provided — never invent tasks; every open task not in the plan goes in canWait; closingLine is one warm, encouraging sentence.`;

const RESET_SYSTEM = `You rebuild the rest of today after interruptions. Be practical and kind, never scolding. Return JSON only: {"keep": [{"id": number, "reason": string}], "move": [{"id": number, "reason": string}], "note": string}. Rules: every task id provided must appear exactly once, either in keep or in move; keep the few most important or time-sensitive tasks today (aim for 3-5); move the rest to tomorrow; each reason is one short sentence; note is one supportive sentence about the new plan.`;

export async function sortBrainDump(
  rawText: string
): Promise<z.infer<typeof SortResultSchema>> {
  if (useMock()) return mockSort(rawText);
  return callOpenAI(
    SORT_SYSTEM,
    `Brain dump to sort:\n\n${rawText}`,
    SortResultSchema
  );
}

export async function lifeRescue(
  tasks: TaskInput[],
  minutesAvailable: number | null,
  energy: string,
  whatsHappening: string
): Promise<z.infer<typeof RescuePlanSchema>> {
  const minutes = minutesAvailable ?? 30;
  if (useMock()) return mockRescue(tasks, minutes);
  const taskLines = tasks
    .map(
      (t) =>
        `- [${t.id}] ${t.title} (${t.category}, ${t.priority}, ${t.estMinutes ?? "?"} min${t.dueDate ? `, due ${t.dueDate}` : ""}${t.waitingOn ? `, waiting on ${t.waitingOn}` : ""})`
    )
    .join("\n");
  return callOpenAI(
    RESCUE_SYSTEM,
    `Time available: ${minutes} minutes. Energy: ${energy}.\nWhat's happening: ${whatsHappening || "(not shared)"}\n\nOpen tasks:\n${taskLines || "(none)"}`,
    RescuePlanSchema
  );
}

export async function resetMyDay(
  tasks: TaskInput[],
  note: string
): Promise<z.infer<typeof DayResetSchema>> {
  if (useMock()) return mockReset(tasks);
  const today = new Date().toISOString().slice(0, 10);
  const taskLines = tasks
    .map(
      (t) =>
        `- [${t.id}] ${t.title} (${t.category}, ${t.priority}, due ${t.dueDate ?? "no date"}${t.waitingOn ? `, waiting on ${t.waitingOn}` : ""})`
    )
    .join("\n");
  return callOpenAI(
    RESET_SYSTEM,
    `Today is ${today}. The day went sideways. ${note ? `Note from the family: ${note}` : ""}\n\nToday's and overdue tasks:\n${taskLines}`,
    DayResetSchema
  );
}

// ---- Deterministic mock (local testing only, MOCK_AI=1) ----

function mockSort(rawText: string): z.infer<typeof SortResultSchema> {
  const lines = rawText
    .split(/\n|,|;/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  const suggestions = lines.slice(0, 20).map((line) => {
    const lower = line.toLowerCase();
    let category: (typeof CATEGORIES)[number] = "general";
    if (/(bill|rent|pay|money|bank|budget|insurance)/.test(lower)) category = "money";
    else if (/(clean|laundry|cook|dinner|mop|plumber|home|fix|grocery|milk|bread)/.test(lower)) category = "home";
    else if (/(kid|school|teacher|permission|pta|family|mom|dad)/.test(lower)) category = "family";
    else if (/(read|rest|walk|exercise|doctor|self|journal)/.test(lower)) category = "myself";
    else if (/(wait|call back|follow up|form|office)/.test(lower)) category = "pending";
    const waitingOn = /(wait|waiting)/.test(lower) ? "someone else" : null;
    return {
      title: line.charAt(0).toUpperCase() + line.slice(1),
      category,
      priority: /(bill|rent|due|urgent|permission)/.test(lower) ? ("high" as const) : ("medium" as const),
      estMinutes: 15,
      waitingOn,
    };
  });
  return { suggestions: suggestions.length ? suggestions : [{ title: rawText.slice(0, 80), category: "general", priority: "medium", estMinutes: 15, waitingOn: null }] };
}

function mockRescue(
  tasks: TaskInput[],
  minutes: number
): z.infer<typeof RescuePlanSchema> {
  const sorted = [...tasks].sort((a, b) => {
    const rank = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
    return rank(a.priority) - rank(b.priority);
  });
  const steps: { title: string; minutes: number }[] = [];
  let used = 0;
  for (const t of sorted) {
    const m = Math.min(t.estMinutes ?? 10, 30);
    if (used + m > minutes && steps.length > 0) break;
    steps.push({ title: t.title, minutes: m });
    used += m;
  }
  const planned = new Set(steps.map((s) => s.title));
  const canWait = tasks.filter((t) => !planned.has(t.title)).map((t) => ({ title: t.title }));
  const firstStep = steps[0] ?? { title: "Take one slow breath, then pick one small thing.", minutes: 2 };
  return {
    firstStep,
    steps: steps.slice(1),
    canWait,
    closingLine: "You don't have to finish it all today — one small step is enough.",
  };
}

function mockReset(tasks: TaskInput[]): z.infer<typeof DayResetSchema> {
  const sorted = [...tasks].sort((a, b) => {
    const rank = (p: string) => (p === "high" ? 0 : p === "medium" ? 1 : 2);
    return rank(a.priority) - rank(b.priority);
  });
  const keep = sorted.slice(0, 3).map((t) => ({ id: t.id, reason: "Most important to finish today." }));
  const move = sorted.slice(3).map((t) => ({ id: t.id, reason: "It can wait until tomorrow." }));
  return { keep, move, note: "A shorter list for the rest of today — tomorrow gets a fresh start." };
}
