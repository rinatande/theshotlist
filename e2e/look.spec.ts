import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * The look (design.md §5.16): a note, a link with two moments, a frame pinned
 * to a shot and seen on shot detail and in shoot mode, and a link opened with
 * no signal. YouTube's title lookup is answered by a stand-in; nothing leaves
 * the machine.
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

async function openLook(page: Page) {
  await page.getByRole("button", { name: "LOOK", exact: true }).click();
}

async function addLink(page: Page) {
  await page.route("**/api/oembed**", (route) => route.fulfill({ json: { title: "Mornings at our Home Cafe", channel: "Taro's House" } }));
  await page.getByRole("link", { name: /^LINK/ }).click();
  await page.getByLabel("LINK", { exact: true }).fill("https://youtu.be/abc123?t=40");
  await expect(page.getByLabel("Moment 1, minutes and seconds")).toHaveValue("0:40");
  await expect(page.getByText("Mornings at our Home Cafe · Taro's House · YouTube")).toBeVisible();
  await page.getByRole("button", { name: "+ ADD MOMENT" }).click();
  await page.getByLabel("Moment 2, minutes and seconds").fill("1:12");
  await page.getByRole("button", { name: "ADD TO LOOK" }).click();
}

test("a note goes on the look", async ({ page }) => {
  await newProject(page, "Look notes");
  await openLook(page);
  await expect(page.getByText("Nothing on the look yet.")).toBeVisible();
  await page.getByRole("link", { name: /^NOTE/ }).click();
  await page.getByLabel("THE LOOK, IN YOUR WORDS").fill("Slow, soft and quiet. Warm grade with soft highlights.");
  await page.getByRole("checkbox", { name: "GRADE" }).click();
  await page.getByRole("button", { name: "SAVE NOTE" }).click();
  await expect(page.getByText("1 REF · 0 PINNED TO SHOTS")).toBeVisible();
  await expect(page.getByText("NOTE · GRADE")).toBeVisible();
  await expect(page.getByText("Warm grade with soft highlights.")).toBeVisible();
});

test("a link keeps two moments, and opens with no signal says why it can't", async ({ page, context }) => {
  await newProject(page, "Look links");
  await openLook(page);
  await addLink(page);
  await expect(page.getByText("0:40 · 1:12 · YOUTUBE")).toBeVisible();
  await expect(page.getByText("2 MOMENTS")).toBeVisible();

  await page.getByRole("link", { name: /Video link, Mornings at our Home Cafe/ }).click();
  await expect(page.getByRole("link", { name: "OPEN AT 0:40 ›" })).toBeVisible();
  // The dev server has no service worker to serve pages offline, so lose signal on the open link.
  await context.setOffline(true);
  await expect(page.getByText("! NO SIGNAL")).toBeVisible();
  await expect(page.getByText("OPEN · NEEDS SIGNAL")).toHaveCount(2);
  await context.setOffline(false);
  await expect(page.getByRole("link", { name: "OPEN AT 1:12 ›" })).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123&t=72s");
});

test("a frame pinned to a shot shows on the shot and in shoot mode", async ({ page }) => {
  await newProject(page, "Look pins");
  await page.getByRole("link", { name: "+ ADD SHOT" }).click();
  await page.getByLabel("SUBJECT").fill("Espresso into the glass");
  await page.getByRole("button", { name: "ADD TO LIST" }).click();

  await openLook(page);
  await page.getByTestId("look-photos").setInputFiles(path.join(__dirname, "fixtures", "frame.png"));
  await expect(page.getByRole("heading", { name: "Add 1 screenshot" })).toBeVisible();
  await page.getByLabel("Time in the video for screenshot 1").fill("0:12");
  await page.getByRole("button", { name: /PIN TO A SHOT/ }).click();
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: "PIN TO 1" }).click();
  await page.getByRole("button", { name: "ADD 1 TO LOOK" }).click();
  await expect(page.getByText("1 REF · 1 PINNED TO SHOTS")).toBeVisible();
  await expect(page.getByRole("link", { name: "Frame at 0:12, pinned to shot 01" })).toBeVisible();

  await page.getByRole("button", { name: "SHOTS", exact: true }).click();
  await page.getByRole("link", { name: /Espresso into the glass/ }).click();
  await expect(page.getByText("REFS · 1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Frame at 0:12" })).toBeVisible();

  await page.goto(page.url().replace(/\/shot\?id=([^&]+).*/, "/shoot?id=$1"));
  await page.getByRole("button", { name: "Open refs for shot 01, 1 ref" }).click();
  await expect(page.getByText("REF 1 / 1")).toBeVisible();
  await page.getByRole("button", { name: "BACK TO THE SHOT" }).click();
  await expect(page.getByRole("button", { name: /GOT IT/ })).toBeVisible();
});
