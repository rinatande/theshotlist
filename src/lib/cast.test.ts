import { describe, expect, it } from "vitest";
import { addSupporting, castConflict, castFor, castLine, castMembers, DEFAULT_ON_CAMERA, inShot, leadCount, memberFor, multiPerson, onCameraLine, peopleFromNames, removeSupporting, setLead, updateMember, YOU } from "./cast";
import { applyEdit, createProject } from "./project";
import { project, REEL_SILENT, shot } from "./test-helpers";
import type { Cast } from "./types";

const ids = () => "priya";

describe("castFor (§5.8)", () => {
  it("starts a self-shoot with you part of it", () => {
    expect(castFor("me")).toMatchObject({ lead: "me", leadMember: { id: YOU, presence: "part" }, operatorPresence: "part" });
  });

  it("puts someone else in front and you behind", () => {
    expect(castFor("someone", " Priya ", ids)).toMatchObject({ lead: "someone", leadMember: { id: "priya", name: "Priya", presence: "part" }, operatorPresence: "none" });
  });

  it("leaves no one on camera, you included", () => {
    const c = castFor("no-one");
    expect(c.leadMember).toBeUndefined();
    expect(c.operatorPresence).toBe("none");
  });

  it("flows from new project's step 1, and edit keeps the rest of the cast", () => {
    const p = createProject({ format: REEL_SILENT, dayCount: 1, lead: "someone", leadName: "Priya" }, new Date(0), ids);
    expect(p.cast.leadMember?.name).toBe("Priya");
    const withMei: Cast = { ...p.cast, supporting: [{ id: "mei", name: "Mei", presence: "part", voice: true }] };
    const edited = applyEdit({ ...p, cast: withMei }, { format: REEL_SILENT, dayCount: 1, lead: "me" }, new Date(0), ids);
    expect(edited.cast.lead).toBe("me");
    expect(edited.cast.supporting.map((m) => m.name)).toEqual(["Mei"]);
  });
});

describe("setLead", () => {
  it("renames someone without losing their presence", () => {
    const c = { ...castFor("someone", "Priya", ids), leadMember: { id: "priya", name: "Priya", presence: "subject" as const, voice: true } };
    expect(setLead(c, "someone", "Priya K").leadMember).toMatchObject({ name: "Priya K", presence: "subject" });
  });
});

describe("castConflict (B6)", () => {
  it("flags talking to camera, and interview, when nobody is on screen", () => {
    const off = { ...castFor("me"), leadMember: { id: YOU, name: "You", presence: "none" as const, voice: true } };
    expect(castConflict("talking-to-camera", off)).toBe(true);
    expect(castConflict("interview", off)).toBe(true);
    expect(castConflict("silent", off)).toBe(false);
  });

  it("isn't a conflict when someone else is the subject (§5.8)", () => {
    const priya = { ...castFor("someone", "Priya", ids), leadMember: { id: "priya", name: "Priya", presence: "subject" as const, voice: true } };
    expect(castConflict("talking-to-camera", priya)).toBe(false);
  });

  it("is settled once voice-over is chosen", () => {
    expect(castConflict("talking-to-camera", { ...castFor("no-one"), voiceOver: true })).toBe(false);
    expect(castConflict("talking-to-camera", castFor("no-one"))).toBe(true);
  });
});

describe("what the read is told", () => {
  it("names the lead, the rest, and you", () => {
    const c: Cast = { ...castFor("someone", "Priya", ids), supporting: [{ id: "b", name: "Buno", role: "dog", presence: "background", voice: false }] };
    const line = onCameraLine(c);
    expect(line).toContain("the lead is Priya: part of it");
    expect(line).toContain("Buno (dog): in the background");
    expect(line).toContain("no voice on camera");
    expect(line).toContain("me, the person filming: not at all");
    expect(line).toContain("street signs");
  });

  it("stays the same for a default self-shoot, so old cached reads still match", () => {
    expect(onCameraLine(castFor("me"))).toBe(DEFAULT_ON_CAMERA);
    expect(onCameraLine({ ...castFor("me"), flagDetails: false })).not.toContain("street signs");
  });
});

describe("who's in a shot", () => {
  const priya = castFor("someone", "Priya", ids);
  const lead = priya.leadMember!;

  it("reads the subject when there's no WHO'S IN IT", () => {
    expect(inShot({ subject: "Priya's hands on the dough" }, lead)).toBe(true);
    expect(inShot({ subject: "The dough resting" }, lead)).toBe(false);
    expect(inShot({ subject: "My hands pouring the beans" }, { id: YOU, name: "You" })).toBe(true);
  });

  it("trusts WHO'S IN IT when it's set", () => {
    expect(inShot({ subject: "Priya's hands", people: [] }, lead)).toBe(false);
    expect(inShot({ subject: "The bench", people: ["priya"] }, lead)).toBe(true);
  });

  it("counts the lead for B8, and nobody for NO ONE", () => {
    const p = project({ cast: priya, shots: [shot("a", 0, { subject: "Priya to camera" }), shot("b", 1, { subject: "The oven" }), shot("c", 2, { subject: "Priya tasting", status: "dropped" })] });
    expect(leadCount(p)).toEqual({ name: "PRIYA", count: 1 });
    expect(leadCount(project({ cast: castFor("no-one") }))).toBeUndefined();
  });

  it("asks WHO'S IN IT only with more than one person who can be on camera", () => {
    expect(multiPerson(castFor("me"))).toBe(false);
    expect(multiPerson(priya)).toBe(false); // you're off camera
    expect(multiPerson({ ...priya, operatorPresence: "part" })).toBe(true);
    expect(castMembers({ ...priya, operatorPresence: "part" }).map((m) => m.id)).toEqual(["priya", YOU]);
  });

  it("maps the read's names to cast ids", () => {
    expect(peopleFromNames({ ...priya, operatorPresence: "part" }, ["priya", "Me", "Stranger"])).toEqual(["priya", YOU]);
  });
});

describe("castLine (B8)", () => {
  it("reads like the board", () => {
    const c: Cast = { ...castFor("someone", "Priya", ids), supporting: [{ id: "m", name: "Mei", presence: "part", voice: true }, { id: "b", name: "Buno", presence: "background", voice: false }] };
    expect(castLine(c)).toBe("Priya (lead) · Mei · Buno · you off camera");
  });
});

describe("the read's cache key", () => {
  it("is unchanged for a default self-shoot, and new when the cast changes", async () => {
    const { readContext, readHash } = await import("./read");
    const base = project();
    expect(readContext(base).onCamera).toBe(DEFAULT_ON_CAMERA);
    const hash = (p: typeof base) => readHash({ brief: "A morning at the café", context: readContext(p) });
    expect(await hash({ ...base, cast: castFor("someone", "Priya", ids) })).not.toBe(await hash(base));
  });
});

describe("editing the cast (B5, B7)", () => {
  it("sets presence on you as lead, keeping your operator presence in step", () => {
    const c = updateMember(castFor("me"), YOU, { presence: "subject" });
    expect(c.leadMember?.presence).toBe("subject");
    expect(c.operatorPresence).toBe("subject");
  });

  it("sets your presence behind the camera when someone else leads", () => {
    const c = updateMember(castFor("someone", "Priya", ids), YOU, { presence: "part" });
    expect(c.operatorPresence).toBe("part");
    expect(c.leadMember?.presence).toBe("part");
  });

  it("clears a voice-over choice once someone is on screen again", () => {
    const empty = { ...castFor("no-one"), voiceOver: true };
    const [withMei, mei] = addSupporting(empty, " Mei ", " sous chef ", () => "mei");
    expect(withMei.supporting[0]).toMatchObject({ name: "Mei", role: "sous chef", presence: "part" });
    expect(withMei.voiceOver).toBe(true); // adding isn't settling; a presence change is
    expect(updateMember(withMei, mei, { presence: "subject" }).voiceOver).toBeUndefined();
    expect(updateMember(withMei, mei, { presence: "background" }).voiceOver).toBe(true);
    expect(removeSupporting(withMei, mei).supporting).toEqual([]);
  });

  it("finds a person and what they are to the project", () => {
    const c = castFor("someone", "Priya", ids);
    expect(memberFor(c, "priya")?.kind).toBe("lead");
    expect(memberFor(c, YOU)).toMatchObject({ kind: "operator", member: { presence: "none" } });
    expect(memberFor(c, "nobody")).toBeUndefined();
  });
});
