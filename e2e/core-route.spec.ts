import { expect, test, type Page } from "@playwright/test";

/**
 * Projects → new project → empty list → brief → what it read → shot list →
 * shoot mode → wrap (CLAUDE.md, v0 scope). Generating is the online read
 * (Rina, 23 Sep), so the read is answered here by a fixed stand-in: nothing
 * is sent to the Anthropic API. The second test proves the other half of the
 * promise — offline, everything but generating still works.
 */
const shot = (subject: string, size = "CU") => ({
  size,
  subject,
  reason: `Why ${subject.toLowerCase()}.`,
  beat: "body",
  light: "any",
  movement: "static",
  sound: "natural",
  location: "Kitchen",
  day: null,
});

const READ = {
  model: "claude-sonnet-5",
  remaining: 4,
  result: {
    quoted: [{ label: "COFFEE MACHINE", kind: "subject" }],
    inferred: [],
    deliverables: [],
    locations: [{ name: "Kitchen", day: null }],
    shots: [shot("Kitchen at rest", "WS"), shot("Descaler going into the tank", "INS"), shot("Clear water flushing through"), shot("Milk frothing in the pitcher"), shot("The finished latte")],
  },
};

async function readsAvailable(page: Page) {
  await page.route("**/api/quota**", (route) => route.fulfill({ json: { available: true, remaining: 5, perDevice: 5 } }));
  await page.route("**/api/read", (route) => route.fulfill({ json: READ }));
}

async function newProject(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("link", { name: "+ NEW PROJECT" }).first().click();
  await page.getByRole("textbox").first().fill(name);
  await page.getByRole("radio", { name: "PERSONAL" }).click();
  await page.getByRole("radio", { name: "SILENT / OBSERVATIONAL" }).click();
  await page.getByRole("button", { name: "NEXT — FORMAT" }).click();
  await page.getByRole("button", { name: "NEXT — GEAR" }).click();
  // Step 3: shooting in real time, gear decided later.
  await page.getByRole("radio", { name: "24", exact: true }).click();
  await page.getByRole("button", { name: "CREATE PROJECT" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("the core route, from a new project to a wrapped day", async ({ page }) => {
  await readsAvailable(page);
  await newProject(page, "Coffee machine");

  // Empty list (E5) → the brief → GENERATE, which is the read.
  await page.getByRole("link", { name: /Suggest from your brief/ }).click();
  await page.getByLabel("WHAT ARE YOU SHOOTING?").fill("Aesthetic vlog of me descaling and flushing the coffee machine at home, then making a latte.");
  await expect(page.getByText("5 full reads left today.")).toBeVisible();
  await page.getByRole("button", { name: "GENERATE SHOTS" }).click();

  // What it read → the read's shots → the list, in the location it suggested.
  await expect(page.getByText("COFFEE MACHINE")).toBeVisible();
  await page.getByRole("button", { name: "BUILD THE LIST" }).click();
  await expect(page.getByText("KITCHEN · NEW").first()).toBeVisible();
  // Only the read's shots: no template library underneath (Rina, 23 Sep).
  await expect(page.getByText(/FROM THE LIBRARY/)).toHaveCount(0);
  await page.getByRole("button", { name: "ADD ALL 5" }).click();
  await expect(page.getByText("5 / 18—24")).toBeVisible();

  // Shoot mode: night only, one shot at a time.
  await page.getByRole("link", { name: "SHOOT MODE" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  const counter = page.getByLabel(/exposed today/);
  await expect(counter).toHaveText("00/05");
  const now = page.locator("[aria-labelledby=now] p").first();

  const first = await now.textContent();
  await page.getByRole("button", { name: "[✓] GOT IT" }).click();
  await expect(counter).toHaveText("01/05");
  await expect(now).not.toHaveText(first!);

  // SKIP sends it to the back; FLAG asks for a note and moves on.
  const skipped = await now.textContent();
  await page.getByRole("button", { name: "SKIP" }).click();
  await expect(now).not.toHaveText(skipped!);
  await page.getByRole("button", { name: "FLAG" }).click();
  await page.getByLabel("WHAT NEEDS CHECKING?").fill("Too dark");
  await page.getByRole("button", { name: "FLAG AND MOVE ON" }).click();

  // Wrap: a one-day shoot, so no chips — but the flag has to be decided first.
  await page.getByRole("link", { name: "WRAP", exact: true }).click();
  await expect(page.getByText("EXPOSED TODAY")).toBeVisible();
  await expect(page.getByText("! TOO DARK")).toBeVisible();
  await expect(page.getByText("Decide the flagged shot first.")).toBeVisible();
  await page.getByRole("radio", { name: "ACCEPT AS IS" }).click();
  await page.getByRole("button", { name: "WRAP", exact: true }).click();

  // Back on the list: the day is wrapped, shoot mode has gone, and nothing was deleted.
  await expect(page.getByRole("link", { name: /SEE THE DAY/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "SHOOT MODE" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "night");
  await page.getByRole("link", { name: /SEE THE DAY/ }).click();
  await expect(page.getByText(/^02\/02 EXPOSED$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^UN-DROP/ })).toHaveCount(3);
});

test("offline, the brief is kept and shots are added by hand — generating waits for signal", async ({ page, context }) => {
  await readsAvailable(page);
  await newProject(page, "Valley day");
  await page.getByRole("link", { name: /Suggest from your brief/ }).click();
  await page.getByLabel("WHAT ARE YOU SHOOTING?").fill("Sunrise walk up the valley, quiet.");
  await expect(page.getByText("5 full reads left today.")).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText("NO SIGNAL", { exact: true })).toBeVisible();
  await expect(page.getByText("Needs signal to generate.")).toBeVisible();
  await expect(page.getByRole("button", { name: "GENERATE SHOTS" })).toHaveAttribute("aria-disabled", "true");
  const byHand = page.getByRole("link", { name: "+ ADD A SHOT BY HAND" });
  await expect(byHand).toHaveAttribute("href", /\/shot\/new\?id=/);

  // The dev server has no service worker, so pages can't load with no signal here;
  // an installed app serves them from its cache. Back online to follow the link —
  // where GENERATE comes back in its place, so go by its address.
  const href = (await byHand.getAttribute("href"))!;
  await context.setOffline(false);
  await expect(page.getByRole("button", { name: "GENERATE SHOTS" })).not.toHaveAttribute("aria-disabled", "true");
  await page.goto(href);
  await page.getByLabel("SUBJECT").fill("Mist in the valley floor");
  await page.getByRole("button", { name: "ADD TO LIST" }).click();
  await expect(page.getByText("Mist in the valley floor")).toBeVisible();
});
