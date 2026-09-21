import Dexie, { type EntityTable } from "dexie";
import type { GearItem, Kit, Project } from "./types";

/**
 * Everything lives on the device (CLAUDE.md: local first). A project is stored
 * whole — its days, locations, shots and briefs travel with it — because every
 * screen reads one project at a time and a shoot is small.
 *
 * Gear and kits are separate tables: the library outlives any one project, and
 * a project keeps its own snapshot of what it used (§8, Gear screens).
 */
export class ShotListDB extends Dexie {
  projects!: EntityTable<Project, "id">;
  gear!: EntityTable<GearItem, "id">;
  kits!: EntityTable<Kit, "id">;

  constructor(name = "theshotlist") {
    super(name);
    this.version(1).stores({
      projects: "id, updatedAt, createdAt, startDate",
      gear: "id, specs.category",
      kits: "id",
    });
  }
}

export const db = new ShotListDB();
