import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DriveStore } from '../../features/drive/state/drive-store';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content {
  // deps
  private store = inject(DriveStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  // expose store signals directly to the template
  viewMode = this.store.viewMode;     // 'grid' | 'list'
  query = this.store.query;           // string
  loading = this.store.loading;       // boolean
  error = this.store.error;           // string | null

  // data from store
  path = () => this.store.breadcrumb();        // Folder[]
  folders = () => this.store.currentFolders(); // Folder[]
  files = () => this.store.currentFiles();     // File[] (already filtered by query)

  constructor() {
    // react to /drive/folder/:id (or /drive/:id); load folder
    effect(async () => {
      // read once per navigation; adjust param name to match your routes
      const idParam =
        this.route.snapshot.paramMap.get('id') ??
        this.route.snapshot.paramMap.get('folderId');

      const folderId = Number(idParam ?? 0);
      await this.store.load(folderId);
    });
  }

  // UI handlers
  setView(mode: ViewMode) {
    this.store.viewMode.set(mode);
  }
  onSearch(ev: Event) {
    const value = (ev.target as HTMLInputElement).value ?? '';
    this.store.search(value);
  }
  clearSearch() {
    this.store.search('');
  }

  // navigation
  async openFolder(id: string | number) {
    await this.router.navigate(['/drive/folder', id]);
    await this.store.load(Number(id));
  }

  // template helpers
  trackById = (_: number, x: any) => x.id;

  isImage(mime?: string) {
    return !!mime && mime.startsWith('image/');
  }
  isPdf(mime?: string) {
    return mime === 'application/pdf';
  }
  safe(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
  iconFor(mime?: string): string {
    if (!mime) return 'insert_drive_file';
    if (mime.startsWith('image/')) return 'image';
    if (mime === 'application/pdf') return 'picture_as_pdf';
    if (mime.includes('zip')) return 'folder_zip';
    if (mime.includes('spreadsheet') || mime.includes('excel')) return 'table_chart';
    if (mime.includes('word') || mime.includes('document')) return 'description';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return 'slideshow';
    return 'insert_drive_file';
  }
}
