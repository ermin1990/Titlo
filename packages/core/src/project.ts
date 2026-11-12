import type { Line, MediaRef, Project, StyleRef } from './types.js';
import { SCHEMA_VERSION } from './types.js';
import { buildLines, nextId, plainText, splitLines } from './text.js';
import { spreadUntimed } from './timing.js';

export interface CreateProjectInput {
  media: MediaRef;
  text: string;
  language?: string;
  styleId?: string;
  filterId?: string | null;
  box?: Project['captionBox'];
}

export function createProject(input: CreateProjectInput): Project {
  const language = input.language ?? 'bs';
  const lines = buildLines(input.text);
  const range = { startMs: 0, endMs: Math.max(1000, input.media.durationMs) };

  return {
    schemaVersion: SCHEMA_VERSION,
    id: nextId('p'),
    language,
    media: input.media,
    trim: { startMs: 0, endMs: range.endMs },
    offsetMs: 0,
    lines: spreadUntimed(lines, range),
    style: { id: input.styleId ?? 'titlo/pop-karaoke', params: {} },
    filter: input.filterId ? { id: input.filterId, params: {} } : null,
    captionBox: input.box ?? { x: 0.5, y: 0.72, width: 0.84 },
    updatedAt: Date.now(),
  };
}

export function projectRange(project: Project): { startMs: number; endMs: number } {
  return { startMs: project.trim.startMs, endMs: project.trim.endMs };
}

export function projectText(project: Project): string {
  return plainText(project.lines);
}

export function withLines(project: Project, lines: Line[]): Project {
  return { ...project, lines, updatedAt: Date.now() };
}

export function withStyle(project: Project, style: StyleRef): Project {
  return { ...project, style, updatedAt: Date.now() };
}

export function withOffset(project: Project, offsetMs: number): Project {
  return {
    ...project,
    offsetMs: Math.round(Math.min(2000, Math.max(-2000, offsetMs))),
    updatedAt: Date.now(),
  };
}

export function withTrim(project: Project, startMs: number, endMs: number): Project {
  const duration = project.media.durationMs;
  const start = Math.max(0, Math.min(Math.round(startMs), duration - 300));
  const end = Math.max(start + 300, Math.min(Math.round(endMs), duration));
  return { ...project, trim: { startMs: start, endMs: end }, updatedAt: Date.now() };
}

export function updateText(project: Project, text: string): Project {
  const lines = buildLines(text);
  return { ...project, lines: spreadUntimed(lines, projectRange(project)), updatedAt: Date.now() };
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  project?: Project;
}

/** Migracije idu po verziji; starija aplikacija nikad ne prepisuje noviji fajl. */
export function migrateProject(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Fajl nije projekat.' };
  const candidate = raw as Partial<Project> & { schemaVersion?: number };

  if (typeof candidate.schemaVersion !== 'number') {
    return { ok: false, error: 'Nedostaje schemaVersion.' };
  }
  if (candidate.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: 'Projekat je napravljen novijom verzijom aplikacije.' };
  }
  if (!candidate.media || !Array.isArray(candidate.lines)) {
    return { ok: false, error: 'Projekat nema video ili redove.' };
  }

  return { ok: true, project: candidate as Project };
}

/** Izvoz projekta bez lokalne putanje videa, da fajl radi na drugom uređaju. */
export function toPortableProject(project: Project): Project {
  return {
    ...project,
    media: { ...project.media, uri: '' },
  };
}

export function countUntimed(project: Project): number {
  return project.lines.reduce(
    (sum, line) => sum + line.words.filter((word) => word.source === 'spread').length,
    0,
  );
}

export function countWords(project: Project): number {
  return project.lines.reduce((sum, line) => sum + line.words.length, 0);
}

export function isTextEmpty(text: string): boolean {
  return splitLines(text).length === 0;
}
