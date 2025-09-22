import { Injectable, inject } from '@angular/core';
import JSZip from 'jszip';
import { DriveStore } from '../../features/drive/state/drive-store';
import { MatSnackBar } from '@angular/material/snack-bar';

type Id = string;

export interface UnzipOptions {
  parentFolderId?: Id;
  rootFolderName?: string;
  useCommonTopLevel?: boolean;
  onProgress?: (percent: number, current?: string) => void;
  sizeLimitBytes?: number;
}

@Injectable({ providedIn: 'root' })
export class UnzipService {
  private store = inject(DriveStore);
  private snackbar = inject(MatSnackBar);

  async extractZipUpload(
    file: File,
    opts: UnzipOptions = {}
  ): Promise<{ rootFolderId: Id; filesCreated: number }> {
    if (!file) {
      this.snackbar.open('No file provided', 'Close', { duration: 3000 });
      throw new Error('No file provided');
    }
    if (!/\.zip$/i.test(file.name) && file.type !== 'application/zip') {
      this.snackbar.open('Not a ZIP file', 'Close', { duration: 3000 });
      throw new Error('Not a ZIP file');
    }

    if (opts.sizeLimitBytes && file.size > opts.sizeLimitBytes) {
      this.snackbar.open(`ZIP too large (${file.size} bytes)`, 'Close', { duration: 3000 });
      throw new Error(`ZIP too large (${file.size} bytes)`);
    }

    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files);

    const files = entries.filter(
      (e) =>
        !e.dir &&
        e.name &&
        !e.name.startsWith('__MACOSX/') &&
        !e.name.endsWith('/.DS_Store') &&
        !/\/?\.DS_Store$/.test(e.name)
    );

    let commonPrefix: string | null = null;
    if (opts.useCommonTopLevel) {
      commonPrefix = this.getCommonTopLevelPrefix(files.map((f) => f.name));
    }

    const parentId = opts.parentFolderId ?? this.store.currentFolderId();
    const defaultRootName = file.name.replace(/\.zip$/i, '');
    const rootName = (opts.rootFolderName || defaultRootName).trim() || 'Extracted';

    // create or reuse root folder
    const rootFolderId = await this.store.ensureFolderPath(parentId, [rootName]);

    opts.onProgress?.(0);

    let created = 0;
    const total = files.length;
    let done = 0;

    for (const entry of files) {
      let pathStr = entry.name;
      if (commonPrefix && pathStr.startsWith(commonPrefix)) {
        pathStr = pathStr.slice(commonPrefix.length);
      }
      const segments = this.safeSegments(pathStr);

      if (!segments.length) {
        done++;
        continue;
      }

      // create nested folders in root
      const folderSegments = segments.slice(0, -1);
      const fileNameRaw = segments[segments.length - 1];

      const targetFolderId = await this.store.ensureFolderPath(rootFolderId, folderSegments);
      const fileName = this.store['_uniquifyName']
        ? (this.store as any)._uniquifyName(targetFolderId, fileNameRaw)
        : fileNameRaw;

      const blobRaw: Blob = await entry.async('blob');
      const typedBlob = this.withGuessedMime(blobRaw, fileName);

      await this.store.addBlobAsFile(fileName, typedBlob, targetFolderId);
      created++;

      done++;
      const pct = Math.min(99, Math.round((done / total) * 100));
      opts.onProgress?.(pct, entry.name);
    }

    opts.onProgress?.(100);
    return { rootFolderId, filesCreated: created };
  }

  // helpers

  private safeSegments(p: string): string[] {
    let s = p.replace(/^[\/\\]+/, '');
    s = s.replace(/\\/g, '/');
    const segs = s.split('/').filter(Boolean);
    const out: string[] = [];
    for (const seg of segs) {
      if (seg === '.' || seg === '') continue;
      if (seg === '..') {
        return [];
      }
      out.push(seg.replace(/[\/\\]+/g, '_'));
    }
    return out;
  }

  private getCommonTopLevelPrefix(paths: string[]): string | null {
    const firsts = paths
      .map(
        (p) =>
          p
            .replace(/^[\/\\]+/, '')
            .split(/[\/\\]/)
            .filter(Boolean)[0]
      )
      .filter(Boolean);
    if (!firsts.length) return null;
    const first = firsts[0];
    return firsts.every((x) => x === first) ? `${first}/` : null;
  }

  private withGuessedMime(blob: Blob, name: string): Blob {
    const type = this.guessMime(name);
    if (!type || blob.type === type) return blob;
    return new Blob([blob], { type });
  }

  private guessMime(name: string): string | '' {
    const ext = name.toLowerCase().split('.').pop() || '';
    switch (ext) {
      case 'txt':
        return 'text/plain';
      case 'md':
        return 'text/markdown';
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      case 'pdf':
        return 'application/pdf';
      case 'png':
        return 'image/png';
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'svg':
        return 'image/svg+xml';
      case 'mp3':
        return 'audio/mpeg';
      case 'wav':
        return 'audio/wav';
      case 'mp4':
        return 'video/mp4';
      case 'webm':
        return 'video/webm';
      case 'doc':
        return 'application/msword';
      case 'docx':
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xls':
        return 'application/vnd.ms-excel';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'ppt':
        return 'application/vnd.ms-powerpoint';
      case 'pptx':
        return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'zip':
        return 'application/zip';
      default:
        return '';
    }
  }
}
