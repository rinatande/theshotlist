import { expect, test } from "@playwright/test";

/**
 * Projects → new project → empty list → brief → what it read → shot list →
 * shoot mode → wrap (CLAUDE.md, v0 scope). The online read is refused here,
 * so this also proves the promise that matters most: the keyword path works
 * on its own, and the route never needs the network (§5.6). Nothing is sent
 * to the Anthropic API.
 */
test.beforeEach(async ({ page }) => {
  await page.route("**/api/quota**", (route) => route.fulfill({ json: { available: false, remaining: 0 } }));
  await page.route("**/api/read", (route) => route.fulfill({ status: 503, json: { reason: "busy", message: "Not in tests." } }));
});

test("the core route, from a new project to a wrapped day", async ({ page }) => {
  // Projects → new project.
  await page.goto("/");
  await page.getByRole("link", { name: "+ NEW PROJECT" }).first().click();
  await page.getByRole("textbox").first().fill("Coffee machine");
  const next = page.getByRole("button", { name: "NEXT — FORMAT" });
  await page.getByRole("radio", { name: "PERSONAL" }).click();
  await page.getByRole("radio", { name: "SILENT / OBSERVATIONAL" }).click();
  await next.click();
  await page.getByRole("button", { name: "CREATE PROJECT" }).click();

  // Empty list (E5) → the brief.
  await expect(page.getByRole("heading", { level: 1, name: "Coffee machine" })).toBeVisible();
  await page.getByRole("link", { name: /Suggest from your brief/ }).click();
  await page.getByLabel("WHAT ARE YOU SHOOTING?").fill("Aesthetic vlog of me descaling and flushing the coffee machine at home, then making a latte at sunrise.");
  // Matched on the device, on a pause in typing — never over the network.
  await expect(page.getByText("SUNRISE", { exact: true })).toBeVisible();
  await expect(page.getByText("ON THIS PHONE")).toBeVisible();
  await page.getByRole("button", { name: "GENERATE SHOTS" }).click();

  // What it read: the online read was refused, so it falls back to quoted chips.
  await page.getByRole("button", { name: "BUILD THE LIST" }).click();

  // Suggestions with reason lines → the list.
  const addAll = page.getByRole("button", { name: /^ADD ALL \d+$/ });
  await expect(addAll).toBeVisible();
  const added = Number((await addAll.textContent())!.match(/\d+/)![0]);
  expect(added).toBeGreaterThan(0);
  await addAll.click();
  await expect(page.getByText(`${added} / 18—24`)).toBeVisible();

  // Shoot mode: night only, one shot at a time.
  await page.getByRole("link", { name: "SHOOT MODE" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "night");
  const counter = page.getByLabel(/exposed today/);
  await expect(counter).toHaveText(`00/${String(added).padStart(2, "0")}`);
  const now = page.locator("[aria-labelledby=now] p").first();

  const first = await now.textContent();
  await page.getByRole("button", { name: "[✓] GOT IT" }).click();
  await expect(counter).toHaveText(`01/${String(added).padStart(2, "0")}`);
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
  await expect(page.getByRole("button", { name: /^UN-DROP/ })).toHaveCount(added - 2);
});
