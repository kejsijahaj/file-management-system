import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

type PreviewData = {
  file: {
    id: number;
    name: string;
    mime: string;
    url: string;
    size?: number;
    updatedAt?: string;
  };
};

@Component({
  selector: 'app-file-preview-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  templateUrl: './file-preview-dialog.html',
  styleUrl: './file-preview-dialog.scss',
})
export class FilePreviewDialog {
  data: PreviewData = inject(MAT_DIALOG_DATA);
  ref = inject(MatDialogRef<FilePreviewDialog>);
  sanitizer = inject(DomSanitizer);
  http = inject(HttpClient);

  safeUrl: SafeResourceUrl | null = null;

  get isImage() {
    return this.data.file.mime.startsWith('image/');
  }

  get isPdf() {
    return this.data.file.mime === 'application/pdf';
  }

  get isText() {
    const m = this.data.file.mime || '';
    return (
      m.startsWith('text/') ||
      ['application/json', 'application/xml', 'application/yaml'].includes(m)
    );
  }

  get isVideo() {
    return this.data.file.mime?.startsWith('video/');
  }

  textLoading = signal(false);
  textError = signal<string | null>(null);
  textContent = signal<string>('');

  ngOnInit() {
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.data.file.url);

    if (this.isText) this.loadText();
  }

  private async loadText() {
    this.textLoading.set(true);
    this.textError.set(null);
    try {
      const text = await this.http.get(this.data.file.url, { responseType: 'text' }).toPromise();
      this.textContent.set(text ?? '');
    } catch (err: any) {
      this.textError.set('Failed to load text content.');
    } finally {
      this.textLoading.set(false);
    }
  }
}
