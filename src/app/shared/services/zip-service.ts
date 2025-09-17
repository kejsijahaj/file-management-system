import { Injectable, inject } from '@angular/core';
import JSZip from 'jszip';
import { Subject } from 'rxjs';

import { Folder } from '../models/folder-model';
import { FileItem } from '../models/file-model';
import { ApiService } from '../../core/api/api-service';

type Id = string;

export interface ZipProgress {
  percent: number; // 0-100
  currentFile?: string; // path inside zip
  totalFiles?: number; // total files to zip
  doneFiles?: number; // total added so far
}

export interface ZipOptions {
  compressionLevel?: number; // 0-9 (default 6)
  onProgress?: (p: ZipProgress) => void;
  cancel$?: Subject<void>; // optional cancellation
  concurrency?: number;
}

export interface ZipSelection {
  userId: string;
  files?: FileItem[];
  folderIds?: Id[];
}

export interface ZipByIdsSelection {
  userId: string;
  fileIds?: Id[];
  folderIds?: Id[];
}

@Injectable({ providedIn: 'root' })
export class ZipService {
  private api = inject(ApiService);

  // convenience wrapper
  async zipByIds(
    sel: ZipByIdsSelection,
    resolveFile: (id: string) => Promise<FileItem | undefined> | FileItem | undefined,
    opts: ZipOptions = {}
  ): Promise<Blob> {
    const files: FileItem[] = [];
    for (const id of sel.fileIds ?? []) {
      const f = await resolveFile(String(id));
      if (f) files.push(f);
    }
    return this.zipSelection({ userId: sel.userId, files, folderIds: sel.folderIds }, opts);
  }

  // create zip for selection
  // returns blob of type zip
  async zipSelection(sel: ZipSelection, opts: ZipOptions = {}): Promise<Blob> {
    const compressionLevel = opts.compressionLevel ?? 6;
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? 6, 12));

    const entries = await this.collectZipEntries(sel);
    const total = entries.length;

    if (total === 0) {
      return new Blob([], { type: 'application/zip' });
    }

    opts.onProgress?.({ percent: 0, totalFiles: total, doneFiles: 0 });

    const zip = new JSZip();
    let doneFiles = 0;

    await this.mapConcurrent(
      entries,
      concurrency,
      async (entry) => {
        const buf = await this.loadFile(entry.file);
        zip.file(entry.pathInZip, buf, {
          compression: 'DEFLATE',
          compressionOptions: { level: compressionLevel },
          date: entry.file.updatedAt ? new Date(entry.file.updatedAt) : undefined,
        });
        doneFiles++;
        opts.onProgress?.({
          percent: Math.round((doneFiles / total) * 100),
          currentFile: entry.pathInZip,
          totalFiles: total,
          doneFiles,
        });
      },
      opts.cancel$
    );

    if (opts.cancel$ && this.isCancelled(opts.cancel$)) {
      throw new Error('Zip cancelled');
      // snackbar maybe
    }

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (m) => {
      opts.onProgress?.({
        percent: Math.min(99, Math.round(m.percent)),
        currentFile: m.currentFile || undefined,
        totalFiles: total,
        doneFiles,
      });
    });

    opts.onProgress?.({ percent: 100, totalFiles: total, doneFiles: total });
    return blob.type ? blob : new Blob([blob], { type: 'application/zip' });
  }

  // collect files and build paths

  private async collectZipEntries(
    sel: ZipSelection
  ): Promise<Array<{ pathInZip: string; file: FileItem }>> {
    const out: Array<{ pathInZip: string; file: FileItem }> = [];
    const dedup = new Set<string>();

    for (const f of sel.files ?? []) {
      const normalized: FileItem = {
        ...f,
        id: String(f.id),
        folderId: String(f.folderId),
        userId: Number(f.userId) as any,
      };
      const path = await this.pathForFile(normalized);
      if (!dedup.has(normalized.id)) {
        dedup.add(normalized.id);
        out.push({ pathInZip: path, file: normalized });
      }
    }

    for (const folderId of sel.folderIds ?? []) {
      await this.walkFolder(String(folderId), sel.userId, async (folder) => {
        const files = await this.api.listFilesInFolder(sel.userId, folder.id);
        for (const f of files) {
          const nf: FileItem = {
            ...f,
            id: String(f.id),
            folderId: String(f.folderId),
            userId: Number(f.userId) as any,
          };
          const path = await this.pathForFile(nf);
          if (!dedup.has(nf.id)) {
            dedup.add(nf.id);
            out.push({ pathInZip: path, file: nf });
          }
        }
      });
    }

    return out;
  }

  private async walkFolder(
    rootId: string,
    userId: string,
    visit: (f: Folder) => Promise<void>
  ): Promise<void> {
    const root = await this.api.getFolder(rootId);
    const normRoot: Folder = {
      ...root,
      id: String(root.id),
      parentId: String(root.parentId),
      userId: Number(root.userId) as any,
    };
    await visit(normRoot);

    const queue: Folder[] = [normRoot];
    while (queue.length) {
      const cur = queue.shift()!;
      const children = await this.api.listChildrenFolders(userId, cur.id);
      for (const c of children) {
        const nf: Folder = {
          ...c,
          id: String(c.id),
          parentId: String(c.parentId),
          userId: Number(c.userId) as any,
        };
        await visit(nf);
        queue.push(nf);
      }
    }
  }

  private async pathForFile(file: FileItem): Promise<string> {
    const segments: string[] = [];
    const path = await this.api.getFolderPath(String(file.folderId));
    for (const seg of path) {
      if (!seg?.name) continue;
      segments.push(this.sanitize(seg.name));
    }
    segments.push(this.sanitize(file.name));
    return segments.join('/');
  }

  private sanitize(name: string): string {
    return (name || '').replace(/[/\\]+/g, '_');
  }

  // load bytes (data url and http)

  private async loadFile(file: FileItem): Promise<ArrayBuffer> {
    if (!file.url) throw new Error(`No Url for "${file.name}"`);
    // snackbar
    if (file.url.startsWith('data:')) {
      return this.dataUrlToArrayBuffer(file.url);
    }
    const res = await fetch(file.url);
    if (!res.ok) throw new Error(`Failed to fetch ${file.name}: ${res.status} ${res.statusText}`);
    return await res.arrayBuffer();
  }

  private async dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
    const m = dataUrl.match(/^data:(.*?)(;base64)?,(.*)$/);
    if (!m) throw new Error('Invalid data URL.'); //snackbar
    const isBase64 = !!m[2];
    const data = decodeURIComponent(m[3]);
    if (isBase64) {
      const raw = atob(data);
      const bytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
      return bytes.buffer;
    } else {
      return new TextEncoder().encode(data).buffer;
    }
  }

  // concurrency and cancellation

  private async mapConcurrent<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
    cancel$?: Subject<void>
  ): Promise<void> {
    let i = 0;
    const run = async () => {
      while (i < items.length) {
        if (cancel$ && this.isCancelled(cancel$)) return;
        const idx = i++;
        await worker(items[idx]);
      }
    };
    await Promise.all(Array.from({ length: concurrency }, run));
  }

  private isCancelled(_cancel$: Subject<void>): boolean {
    return false;
  }
}
