// End-to-end test for the standalone Life Reset server.
// Run with: bun run test-e2e.ts   (server must be running on :3100 with MOCK_AI=1)
const BASE = process.env.BASE_URL || "http://localhost:3100";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, extra?: string) {
  if (cond) {
    passed++;
    console.log(`  PASS ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL ${name}${extra ? " — " + extra : ""}`);
  }
}

async function call(action: string, args: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`${BASE}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args }),
  });
  const json = (await res.json()) as any;
  if (!json.ok) {
    const e: any = new Error(json.error || `HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return json.data;
}

async function expectError(name: string, fn: () => Promise<any>, match?: string) {
  try {
    await fn();
    check(name, false, "expected an error but the call succeeded");
  } catch (e: any) {
    check(name, !match || String(e.message).includes(match), `got: ${e.message}`);
  }
}

const S = {
  sellerToken: "",
  dadToken: "",
  kidToken: "",
  buyerToken: "",
  sellerTaskId: 0,
  dumpId: 0,
  codeEss: "",
  codeComplete: "",
  codeEss2: "",
};

async function main() {
  console.log("== entry / auth gate ==");
  const auth0: any = await call("getAuthState");
  check("authstate: no logins yet", auth0.loginsEnabled === false);
  check("authstate: seller household name", auth0.householdName === "Our Household");
  await expectError("appstate without token is refused", () => call("getAppState"), "sign in");

  console.log("== seller household (claims id 1) ==");
  const seller: any = await call("createHousehold", {
    householdName: "Test Seller",
    name: "Test Mom",
    username: "testmom",
    pin: "1111",
  });
  S.sellerToken = seller.sessionToken;
  check("seller household id is 1", seller.householdId === 1);
  const st: any = await call("getAppState", { sessionToken: S.sellerToken });
  check("seller plan is free", st.settings.planTier === "free");
  check("seller isSeller", st.settings.isSeller === true);
  check("square essentials link", st.settings.squareEssentialsUrl === "https://square.link/u/ZlUo3Ah1");
  check("square complete link", st.settings.squareCompleteUrl === "https://square.link/u/fM9kaEWx");
  check("square vip link", st.settings.squareVipUrl === "https://square.link/u/2ozR3LI6");
  check("viewer is admin", st.viewer.role === "admin");
  await expectError("duplicate username refused", () =>
    call("createHousehold", { householdName: "X", name: "X", username: "TESTMOM", pin: "9999" }),
    "already taken"
  );

  console.log("== join code + members ==");
  const jc: any = await call("setJoinCode", { joinCode: "MAPLE-77", sessionToken: S.sellerToken });
  check("join code set", jc.joinCode === "MAPLE-77");
  const dad: any = await call("addMember", { name: "Test Dad", sessionToken: S.sellerToken });
  check("member added", typeof dad.id === "number");
  const dadLogin: any = await call("setMemberLogin", {
    memberId: dad.id,
    username: "testdad",
    pin: "2222",
    sessionToken: S.sellerToken,
  });
  check("dad login set", dadLogin.username === "testdad");
  const dadSess: any = await call("login", { username: "testdad", pin: "2222" });
  S.dadToken = dadSess.sessionToken;
  check("dad login works", !!S.dadToken);
  await expectError("wrong PIN refused", () => call("login", { username: "testdad", pin: "9999" }), "don't match");
  const kid: any = await call("joinHousehold", {
    joinCode: "maple-77",
    name: "Test Kid",
    username: "testkid",
    pin: "3333",
  });
  S.kidToken = kid.sessionToken;
  check("kid joined via code (case-insensitive)", kid.householdId === 1 && kid.member.role === "member");
  await expectError("bad join code refused", () =>
    call("joinHousehold", { joinCode: "NOPE-00", name: "X", username: "xkid", pin: "3333" }),
    "doesn't match"
  );
  await expectError("non-admin cannot set logins", () =>
    call("setMemberLogin", { memberId: dad.id, username: "testdad2", sessionToken: S.dadToken }),
    "Only the household admin"
  );

  console.log("== brain dump + AI sort (mock) ==");
  const dump: any = await call("addBrainDump", {
    rawText: "pay electric bill $125, sign permission slip, buy milk and bread, call teacher, fold laundry",
    sessionToken: S.sellerToken,
  });
  S.dumpId = dump.id;
  const sorted: any = await call("sortBrainDump", { id: S.dumpId, sessionToken: S.sellerToken });
  check("sort returns suggestions", Array.isArray(sorted.suggestions) && sorted.suggestions.length >= 3);
  const created: any = await call("confirmSortedTasks", {
    dumpId: S.dumpId,
    tasks: sorted.suggestions,
    sessionToken: S.sellerToken,
  });
  check("sorted tasks created", created.createdIds.length === sorted.suggestions.length);
  S.sellerTaskId = created.createdIds[0];

  console.log("== tasks ==");
  const t1: any = await call("addTask", { title: "PTA meeting", category: "family", priority: "high", dueDate: "2026-11-21", sessionToken: S.sellerToken });
  await call("addTask", { title: "Mop the kitchen", category: "home", dueDate: new Date().toISOString().slice(0, 10), sessionToken: S.sellerToken });
  await call("addTask", { title: "Grocery budget", category: "money", sessionToken: S.sellerToken });
  await call("addTask", { title: "Read 20 pages", category: "myself", sessionToken: S.sellerToken });
  const top: any = await call("setTopPriorities", { ids: [S.sellerTaskId, t1.id], sessionToken: S.sellerToken });
  check("top priorities set", top.pinnedIds.length === 2);
  const upd: any = await call("updateTask", { id: t1.id, title: "PTA meeting at 6pm", notes: "bring snacks", sessionToken: S.sellerToken });
  check("task updated", upd.id === t1.id);
  const done: any = await call("setTaskStatus", { id: S.sellerTaskId, status: "done", sessionToken: S.sellerToken });
  check("task done stamps time", done.status === "done" && !!done.completedAt);
  const st2: any = await call("getAppState", { sessionToken: S.sellerToken });
  check("stats doneToday 1", st2.stats.doneToday === 1);
  check("tasks visible", st2.tasks.length >= 6);

  console.log("== bills ==");
  const bill: any = await call("addBill", { name: "Electric bill", amountCents: 12500, dueDate: "2026-11-25", sessionToken: S.sellerToken });
  const paid: any = await call("setBillPaid", { id: bill.id, paid: true, sessionToken: S.sellerToken });
  check("bill marked paid", paid.paid === true);

  console.log("== free-tier AI gate ==");
  await expectError("lifeRescue refused on free", () =>
    call("lifeRescue", { minutesAvailable: 20, energy: "low", whatsHappening: "swamped", sessionToken: S.sellerToken }),
    "paid plan"
  );
  await expectError("resetMyDay refused on free", () =>
    call("resetMyDay", { note: "chaos", sessionToken: S.sellerToken }),
    "paid plan"
  );

  console.log("== unlock codes ==");
  const code1: any = await call("createUnlockCode", { tier: "essentials", note: "Test Buyer", sessionToken: S.sellerToken });
  S.codeEss = code1.code;
  check("code format LR-XXXX-XXXX", /^LR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code1.code));

  console.log("== buyer household + redeem ==");
  const buyer: any = await call("createHousehold", {
    householdName: "Test Buyer",
    name: "Buyer Mom",
    username: "buyermom",
    pin: "4444",
  });
  S.buyerToken = buyer.sessionToken;
  check("buyer household id 2", buyer.householdId === 2);
  const bst: any = await call("getAppState", { sessionToken: S.buyerToken });
  check("buyer starts free", bst.settings.planTier === "free");
  check("buyer got square links copied", bst.settings.squareEssentialsUrl === "https://square.link/u/ZlUo3Ah1");
  await expectError("non-seller admin cannot issue codes", () =>
    call("createUnlockCode", { tier: "vip", sessionToken: S.buyerToken }),
    "seller"
  );
  const red1: any = await call("redeemUnlockCode", { code: S.codeEss.toLowerCase().replace(/-/g, ""), sessionToken: S.buyerToken });
  check("redeem works (lowercase, no dashes)", red1.planTier === "essentials");
  await expectError("code reuse refused", () =>
    call("redeemUnlockCode", { code: S.codeEss, sessionToken: S.buyerToken }),
    "already been used"
  );
  const code2: any = await call("createUnlockCode", { tier: "complete", sessionToken: S.sellerToken });
  S.codeComplete = code2.code;
  const red2: any = await call("redeemUnlockCode", { code: S.codeComplete, sessionToken: S.buyerToken });
  check("upgrade to complete", red2.planTier === "complete");
  const code3: any = await call("createUnlockCode", { tier: "essentials", sessionToken: S.sellerToken });
  S.codeEss2 = code3.code;
  await expectError("lower code vs higher plan refused", () =>
    call("redeemUnlockCode", { code: S.codeEss2, sessionToken: S.buyerToken }),
    "already on"
  );
  const codes: any = await call("listUnlockCodes", { sessionToken: S.sellerToken });
  const ess2 = codes.codes.find((c: any) => c.code === S.codeEss2);
  check("refused code stays unused", ess2 && ess2.redeemed === false);
  await expectError("wrong code refused", () =>
    call("redeemUnlockCode", { code: "LR-ZZZZ-ZZZZ", sessionToken: S.buyerToken }),
    "doesn't match"
  );
  // updateHousehold must ignore a smuggled planTier — plan stays put.
  await call("updateHousehold", { householdName: "Test Buyer", planTier: "vip", sessionToken: S.buyerToken });
  const afterFlip: any = await call("getAppState", { sessionToken: S.buyerToken });
  check("plan cannot be flipped directly", afterFlip.settings.planTier === "complete");

  console.log("== paid AI features (buyer, mock) ==");
  await call("addTask", { title: "Sign permission slip", category: "family", priority: "high", estMinutes: 5, sessionToken: S.buyerToken });
  await call("addTask", { title: "Pay electric bill", category: "money", priority: "high", estMinutes: 10, sessionToken: S.buyerToken });
  await call("addTask", { title: "Fold laundry", category: "home", estMinutes: 20, sessionToken: S.buyerToken });
  await call("addTask", { title: "Water the plants", category: "home", priority: "low", estMinutes: 5, sessionToken: S.buyerToken });
  const rescue: any = await call("lifeRescue", { minutesAvailable: 20, energy: "low", whatsHappening: "swamped", sessionToken: S.buyerToken });
  check("rescue has first step", !!rescue.firstStep?.title);
  check("rescue has canWait", Array.isArray(rescue.canWait));
  check("rescue has closing line", typeof rescue.closingLine === "string" && rescue.closingLine.length > 0);
  const reset: any = await call("resetMyDay", { note: "day went sideways", sessionToken: S.buyerToken });
  check("reset has keep+move", Array.isArray(reset.keep) && Array.isArray(reset.move));
  const moveIds = reset.move.map((m: any) => m.id);
  if (moveIds.length) {
    const applied: any = await call("applyDayReset", { taskIds: moveIds, dueDate: "2026-11-20", sessionToken: S.buyerToken });
    check("day reset applied", applied.movedIds.length === moveIds.length);
  } else {
    check("day reset applied (nothing to move)", true);
  }

  console.log("== household isolation ==");
  const bst2: any = await call("getAppState", { sessionToken: S.buyerToken });
  check("buyer sees none of seller tasks", !bst2.tasks.some((t: any) => t.id === S.sellerTaskId));
  check("buyer sees none of seller members", !bst2.members.some((m: any) => m.username === "testmom"));
  await expectError("cross-household task update refused", () =>
    call("updateTask", { id: S.sellerTaskId, title: "HACK", sessionToken: S.buyerToken }),
    "no longer exists"
  );
  await expectError("cross-household bill refused", () =>
    call("setBillPaid", { id: bill.id, paid: false, sessionToken: S.buyerToken }),
    "no longer exists"
  );
  await expectError("buyer cannot set seller square link", () =>
    call("setSquareLink", { pkg: "essentials", url: "https://evil.example", sessionToken: S.buyerToken }),
    "seller"
  );

  console.log("== forgot PIN ==");
  await expectError("wrong join code refused", () =>
    call("resetPinWithJoinCode", { username: "testkid", joinCode: "WRONG-00", newPin: "9999" }),
    "don't match"
  );
  const resetPin: any = await call("resetPinWithJoinCode", { username: "testkid", joinCode: "MAPLE-77", newPin: "7777" });
  check("forgot-PIN returns new session", !!resetPin.sessionToken);
  await expectError("old PIN rejected after reset", () => call("login", { username: "testkid", pin: "3333" }), "don't match");
  const kidNew: any = await call("login", { username: "testkid", pin: "7777" });
  check("new PIN works", !!kidNew.sessionToken);
  await expectError("pre-reset kid session invalidated", () =>
    call("getAppState", { sessionToken: S.kidToken }),
    "sign in"
  );

  console.log("== change PIN + logout ==");
  await call("changeMyPin", { currentPin: "2222", newPin: "2223", sessionToken: S.dadToken });
  const dadNew: any = await call("login", { username: "testdad", pin: "2223" });
  check("changed PIN works", !!dadNew.sessionToken);
  await call("logout", { sessionToken: dadNew.sessionToken });
  await expectError("logged-out token refused", () =>
    call("getAppState", { sessionToken: dadNew.sessionToken }),
    "sign in"
  );

  console.log("== join code uniqueness ==");
  await expectError("duplicate join code refused", () =>
    call("setJoinCode", { joinCode: "MAPLE-77", sessionToken: S.buyerToken }),
    "already in use"
  );

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) console.log("Failures:", failures.join("; "));
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
