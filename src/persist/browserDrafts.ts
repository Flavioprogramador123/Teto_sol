import type { PersistProject } from "./client";

const DB_NAME = "planosol-drafts";
const DB_VERSION = 1;
const STORE = "drafts";
export const MAX_BROWSER_DRAFTS = 3;

export interface BrowserDraft {
  id: string;
  name: string;
  updatedAt: string;
  project: PersistProject;
  imageData: string;
  originalData: string | null;
}

export interface BrowserDraftMeta {
  id: string;
  name: string;
  updatedAt: string;
  hasImage: boolean;
  step: string;
}

export interface PlanosolPortableFile {
  kind: "planosol-project";
  format: 1;
  savedAt: string;
  project: PersistProject;
  imageData: string;
  originalData: string | null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB indisponível."));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha IndexedDB."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB abortado."));
  });
}

export function slugDraftId(name: string): string {
  const base =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 40) || "projeto";
  return `${base}-${Date.now().toString(36)}`;
}

export async function listBrowserDrafts(): Promise<BrowserDraftMeta[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const rows = (req.result as BrowserDraft[]) ?? [];
        resolve(
          rows
            .map((d) => ({
              id: d.id,
              name: d.name,
              updatedAt: d.updatedAt,
              hasImage: Boolean(d.imageData),
              step: d.project?.step ?? "import",
            }))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      };
    });
  } catch {
    return [];
  }
}

export async function getBrowserDraft(id: string): Promise<BrowserDraft | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as BrowserDraft) ?? null);
  });
}

export async function deleteBrowserDraft(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(id);
  await txDone(tx);
}

/** Grava/atualiza rascunho; mantém no máximo MAX_BROWSER_DRAFTS (remove os mais antigos). */
export async function putBrowserDraft(input: {
  id?: string | null;
  name: string;
  project: PersistProject;
  imageData: string;
  originalData?: string | null;
}): Promise<BrowserDraft> {
  if (!input.imageData) throw new Error("Sem imagem para gravar o rascunho.");
  const db = await openDb();
  const id = input.id?.trim() || slugDraftId(input.name);
  const draft: BrowserDraft = {
    id,
    name: input.name.trim() || "Projeto",
    updatedAt: new Date().toISOString(),
    project: { ...input.project, id, name: input.name.trim() || "Projeto", savedAt: new Date().toISOString() },
    imageData: input.imageData,
    originalData: input.originalData ?? null,
  };

  const all = await new Promise<BrowserDraft[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as BrowserDraft[]) ?? []);
  });

  const others = all.filter((d) => d.id !== id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const keepOthers = others.slice(0, MAX_BROWSER_DRAFTS - 1);
  const drop = others.slice(MAX_BROWSER_DRAFTS - 1);

  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const d of drop) store.delete(d.id);
  store.put(draft);
  await txDone(tx);
  void keepOthers;
  return draft;
}

export function buildPortableFile(
  project: PersistProject,
  imageData: string,
  originalData?: string | null,
): PlanosolPortableFile {
  return {
    kind: "planosol-project",
    format: 1,
    savedAt: new Date().toISOString(),
    project,
    imageData,
    originalData: originalData ?? null,
  };
}

export function downloadPortableProject(file: PlanosolPortableFile, filename?: string) {
  const safe =
    (filename || file.project.name || "projeto")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "_")
      .slice(0, 60) || "projeto";
  const blob = new Blob([`${JSON.stringify(file)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.planosol.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function parsePortableProjectFile(file: File): Promise<PlanosolPortableFile> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("JSON inválido.");
  }
  const data = raw as Partial<PlanosolPortableFile>;
  if (data.kind !== "planosol-project" || data.format !== 1 || !data.project || !data.imageData) {
    throw new Error("Arquivo esperado: .planosol.json (projeto + imagem).");
  }
  return {
    kind: "planosol-project",
    format: 1,
    savedAt: data.savedAt || new Date().toISOString(),
    project: data.project,
    imageData: data.imageData,
    originalData: data.originalData ?? null,
  };
}
