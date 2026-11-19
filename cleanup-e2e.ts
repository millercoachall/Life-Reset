// Cleanup after test-e2e.ts: log back in and delete everything the test created,
// then verify the households are empty again (via the API, not the DB file).
const BASE = process.env.BASE_URL || "http://localhost:3100";

async function call(action: string, args: Record<string, unknown> = {}) {
  const res = await fetch(`${BASE}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const json = (await res.json()) as any;
  if (!json.ok) throw new Error(`${action}: ${json.error}`);
  return json.data;
}

async function cleanHousehold(username: string, pin: string, label: string) {
  const sess: any = await call("login", { username, pin });
  const t = sess.sessionToken;
  const st: any = await call("getAppState", { sessionToken: t });
  console.log(`${label}: before cleanup — tasks ${st.tasks.length}, bills ${st.bills.length}, dumps ${st.dumps.length}, members ${st.members.length}`);
  for (const task of st.tasks) await call("deleteTask", { id: task.id, sessionToken: t });
  for (const bill of st.bills) await call("deleteBill", { id: bill.id, sessionToken: t });
  for (const d of st.dumps) await call("deleteBrainDump", { id: d.id, sessionToken: t });
  // Remove non-admin members (their logins go with them).
  for (const m of st.members) {
    if (m.username === username) continue;
    if (m.hasLogin) await call("removeMemberLogin", { memberId: m.id, sessionToken: t });
    await call("deleteMember", { id: m.id, sessionToken: t });
  }
  const after: any = await call("getAppState", { sessionToken: t });
  console.log(
    `${label}: after cleanup — tasks ${after.tasks.length}, bills ${after.bills.length}, dumps ${after.dumps.length}, members ${after.members.length} (${after.members.map((m: any) => m.username).join(",")})`
  );
  const ok = after.tasks.length === 0 && after.bills.length === 0 && after.dumps.length === 0 && after.members.length === 1;
  console.log(`${label}: CLEAN ${ok ? "YES" : "NO"}`);
  return ok;
}

async function main() {
  const a = await cleanHousehold("testmom", "1111", "seller");
  const b = await cleanHousehold("buyermom", "4444", "buyer");
  console.log(a && b ? "ALL CLEAN" : "CLEANUP INCOMPLETE");
  process.exit(a && b ? 0 : 1);
}
main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
