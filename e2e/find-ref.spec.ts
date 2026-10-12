import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Find a ref (design.md §5.17): from a shot, search elsewhere, come back with
 * a screenshot, and it lands pinned to that shot. The search page is answered
 * by a stand-in; nothing leaves the machine.
 */

async function newProject(page: Page, name: string) {
  await page.goto("/projects");
  await page.getByRole("link", { name: "+ NEW PROJECT" }).first().click();
  await page.getByRole("textbox").first().fill(name);
  await page.getByRole("radio", { name: "PERSONAL" }).click();
  await page.getByRole("radio", { name: "SILENT / OBSERVATIONAL" }).click();
  await page.getByRole("button", { name: "NEXT — FORMAT" }).click();
  await page.getByRole("button", { name: "NEXT — GEAR" }).click();
  await page.getByRole("radio", { name: "24", exact: true }).click();
  await page.getByRole("button", { name: "CREATE PROJECT" }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("find a ref, add the screenshot, and it lands pinned on the shot", async ({ page, context }) => {
  await context.route("https://www.pinterest.com/**", (route) => route.fulfill({ body: "<title>Pinterest stand-in</title>", contentType: "text/html" }));
  await newProject(page, "Find a ref");
  await page.getByRole("link", { name: "+ ADD SHOT" }).click();
  await page.getByLabel("SUBJECT").fill("Espresso into the glass");
  await page.getByRole("button", { name: "ADD TO LIST" }).click();
  await page.getByRole("link", { name: /Espresso into the glass/ }).click();

  await page.getByRole("button", { name: "FIND A REF" }).click();
  await expect(page.getByRole("heading", { name: "FIND A REF · SHOT 01 · ESPRESSO INTO THE GLASS" })).toBeVisible();
  await expect(page.getByLabel("SEARCH FOR")).toHaveValue(/^espresso into the glass/);
  await expect(page.getByText("Searches one hashtag: #espressoglass")).toBeVisible();
  await expect(page.getByRole("button", { name: "ADD YOUR SCREENSHOT" })).toHaveCount(0);

  const opened = context.waitForEvent("page");
  await page.getByRole("link", { name: /PINTEREST/ }).click();
  const search = await opened;
  await expect(search).toHaveURL(/pinterest\.com\/search\/pins\/\?q=espresso%20into%20the%20glass/);
  await search.close();

  await expect(page.getByRole("button", { name: "ADD YOUR SCREENSHOT" })).toBeVisible();
  await page.getByTestId("look-photos").setInputFiles(path.join(__dirname, "fixtures", "frame.png"));
  await expect(page.getByText("YOU WERE FINDING A REF FOR 01 · ESPRESSO INTO THE GLASS")).toBeVisible();
  await expect(page.getByText("TO FIND A REF · LOOK")).toBeVisible();
  await page.getByRole("button", { name: "ADD AND PIN TO 01" }).click();

  await expect(page.getByRole("status")).toHaveText(/PINNED TO 01 · ON THE LOOK TOO/);
  await expect(page.getByText("REFS · 1")).toBeVisible();
  await expect(page.getByRole("link", { name: /just added/ })).toBeVisible();

  await page.getByRole("button", { name: "UNDO" }).click();
  await expect(page.getByText("REFS · 0")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("with no signal, the searches say why they can't", async ({ page, context }) => {
  await newProject(page, "Find offline");
  await page.getByRole("link", { name: "+ ADD SHOT" }).click();
  await page.getByLabel("SUBJECT").fill("Beans into the grinder");
  await page.getByRole("button", { name: "ADD TO LIST" }).click();
  await page.getByRole("link", { name: /Beans into the grinder/ }).click();
  // The dev server has no service worker to serve pages offline, so lose signal on the open shot.
  await expect(page.getByRole("button", { name: "FIND A REF" })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "FIND A REF" }).click();
  await expect(page.getByText("PINTEREST · NEEDS SIGNAL")).toBeVisible();
  await expect(page.getByText("INSTAGRAM · NEEDS SIGNAL")).toBeVisible();
  await expect(page.getByRole("link", { name: /PINTEREST/ })).toHaveCount(0);
  await context.setOffline(false);
});
