import { create } from 'zustand';
import type { MediaRef, Project } from '@titlo/core';
import { createProject, migrateProject, toPortableProject } from '@titlo/core';

export type Step = 'start' | 'text' | 'tap' | 'edit';

const DRAFT_KEY = 'titlo:draft:v1';
const PROJECT_KEY = 'titlo:project:v1';

interface Draft {
  text: string;
  styleId: string;
  filterId: string | null;
  language: string;
}

function readDraft(): Draft {
  if (typeof localStorage === 'undefined') {
    return { text: '', styleId: 'titlo/pop-karaoke', filterId: null, language: 'bs' };
  }
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<Draft>;
    return {
      text: parsed.text ?? '',
      styleId: parsed.styleId ?? 'titlo/pop-karaoke',
      filterId: parsed.filterId ?? null,
      language: parsed.language ?? 'bs',
    };
  } catch {
    return { text: '', styleId: 'titlo/pop-karaoke', filterId: null, language: 'bs' };
  }
}

function saveDraft(draft: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* privatni način rada: nastavi bez čuvanja */
  }
}

function readProject(): Project | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PROJECT_KEY);
    if (!raw) return null;
    const result = migrateProject(JSON.parse(raw));
    return result.ok ? (result.project ?? null) : null;
  } catch {
    return null;
  }
}

function saveProject(project: Project): void {
  try {
    localStorage.setItem(PROJECT_KEY, JSON.stringify(toPortableProject(project)));
  } catch {
    /* projekat je i dalje u memoriji */
  }
}

interface AppState {
  step: Step;
  text: string;
  language: string;
  project: Project | null;
  videoUrl: string | null;
  videoFile: File | null;
  media: MediaRef | null;
  fileName: string | null;
  toast: string | null;
  /** Zadnji projekat sačuvan na uređaju, bez videa. */
  savedProject: Project | null;
  /** Indeks riječi od koje tapkanje počinje. */
  tapStart: number;
  /** Gdje se vraćamo kad tapkanje završi. */
  tapReturnTo: 'edit' | 'text';

  setStep: (step: Step) => void;
  setText: (text: string) => void;
  setLanguage: (language: string) => void;
  setVideoFile: (file: File, url: string, media: MediaRef) => void;
  setProject: (project: Project) => void;
  beginProject: (options?: { styleId?: string; filterId?: string | null }) => void;
  beginFromProject: (project: Project) => void;
  startTappingAt: (index: number, returnTo: 'edit' | 'text') => void;
  resumeProject: (file: File, loaded: { url: string; media: MediaRef }) => void;
  reset: () => void;
  showToast: (message: string | null) => void;
}

export const useApp = create<AppState>((set, get) => {
  const draft = readDraft();
  return {
    step: 'start',
    text: draft.text,
    language: draft.language,
    project: null,
    videoUrl: null,
    videoFile: null,
    media: null,
    fileName: null,
    toast: null,
    savedProject: readProject(),
    tapStart: 0,
    tapReturnTo: 'text',

    setStep: (step) => set({ step }),

    setText: (text) => {
      set({ text });
      saveDraft({
        text,
        styleId: get().project?.style.id ?? 'titlo/pop-karaoke',
        filterId: get().project?.filter?.id ?? null,
        language: get().language,
      });
    },

    setLanguage: (language) => {
      set({ language });
      saveDraft({
        text: get().text,
        styleId: get().project?.style.id ?? 'titlo/pop-karaoke',
        filterId: get().project?.filter?.id ?? null,
        language,
      });
    },

    setVideoFile: (file, url, media) =>
      set({ videoFile: file, videoUrl: url, media, fileName: file.name }),

    setProject: (project) => {
      set({ project, savedProject: project });
      saveProject(project);
      saveDraft({
        text: project.lines.map((line) => line.words.map((word) => word.text).join(' ')).join('\n'),
        styleId: project.style.id,
        filterId: project.filter?.id ?? null,
        language: project.language,
      });
    },

    beginProject: (options) => {
      const { text, media, language, videoUrl } = get();
      if (!media || !videoUrl) return;
      const project = createProject({
        media: { ...media, uri: videoUrl },
        text,
        language,
        styleId: options?.styleId ?? 'titlo/pop-karaoke',
        filterId: options?.filterId ?? null,
      });
      set({ project, step: 'text' });
    },

    beginFromProject: (project) => set({ project, text: '' }),

    startTappingAt: (index, returnTo) => set({ tapStart: index, tapReturnTo: returnTo }),

    resumeProject: (file, loaded) => {
      const saved = get().savedProject;
      if (!saved) return;
      const project: Project = {
        ...saved,
        media: {
          ...saved.media,
          ...loaded.media,
          uri: loaded.url,
          name: file.name,
        },
        updatedAt: Date.now(),
      };
      set({
        project,
        savedProject: project,
        videoFile: file,
        videoUrl: loaded.url,
        media: loaded.media,
        fileName: file.name,
        step: 'edit',
      });
      saveProject(project);
    },

    reset: () =>
      set({
        step: 'start',
        project: null,
        videoFile: null,
        videoUrl: null,
        media: null,
        fileName: null,
        toast: null,
        tapStart: 0,
        tapReturnTo: 'text',
      }),

    showToast: (toast) => set({ toast }),
  };
});
