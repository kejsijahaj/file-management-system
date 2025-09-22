import { Injectable, inject } from '@angular/core';
import { saveAs } from 'file-saver';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class DownloadService {
  private snackbar = inject(MatSnackBar);

  async save(blob: Blob, filename: string): Promise<void> {
    try {
        saveAs(blob, filename);
        return;
    } catch {
        const url = URL.createObjectURL(blob);
        try{
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.rel = 'noopener';
            a.style.display = 'none';
            document.body.appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
    }
  }

  //save url directly
  async saveFromUrl(url: string, filename: string): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
      this.snackbar.open(`Failed to fetch: ${res.status} ${res.statusText}`, 'Close', { duration: 3000 });
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }
    const blob = await res.blob();
    await this.save(blob, filename);
  }

  // save data url string
  async saveDataUrl(dataUrl: string, filename: string): Promise<void> {
    const blob = this._dataUrlToBlob(dataUrl);
    await this.save(blob, filename);
  }

  // save plain text as file
  async saveText(text: string, filename: string, mime = 'text/plain;charset=utf-8'): Promise<void> {
    const blob = new Blob([text], { type: mime });
    await this.save(blob, filename);
  }

  // save json prettified
  async saveJson(obj: unknown, filename: string): Promise<void> {
    const blob = new Blob([JSON.stringify(obj, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    await this.save(blob, filename);
  }

  // zip helper
  async saveZip(parts: BlobPart[] | Blob, filename: string): Promise<void> {
    const blob = parts instanceof Blob ? parts : new Blob(parts, { type: 'application/zip' });
    await this.save(blob, filename.endsWith('.zip') ? filename : `${filename}.zip`);
  }

  // helpers

  private _dataUrlToBlob(dataUrl: string): Blob {
    const m = dataUrl.match(/^data:(.*?)(;base64)?,(.*)$/);
    if (!m) {
      this.snackbar.open('Invalid data URL', 'Close', { duration: 3000 });
      throw new Error('Invalid data URL');
    }
    const mime = m[1] || 'application/octet-stream';
    const isBase64 = !!m[2];

    if (isBase64) {
      const binary = atob(m[3]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } else {
      const text = decodeURIComponent(m[3]);
      return new Blob([text], { type: mime });
    }
  }

  private _extFromName(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot >= 0 ? name.slice(dot) : '';
  }
}
