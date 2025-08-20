// src/app/ui/content/content.ts
import { Component, inject } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { DriveStore } from '../../features/drive/state/drive-store';
import { FileItem } from '../../shared/models/file-model';
import { Folder } from '../../shared/models/folder-model';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [NgIf, NgFor, RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './content.html',
  styleUrls: ['./content.scss']
})
export class Content {
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  readonly store = inject(DriveStore);
  private router = inject(Router);

  private searchTimer: any;

  async ngOnInit() {
    // React to /drive/folder/:id
    this.route.params.subscribe(async p => {
      const id = Number(p['id'] ?? 0);
      await this.store.load(Number.isFinite(id) ? id : 0);
    });
  }

  // expose signals to template as functions (ergonomic)
  files(): FileItem[]   { return this.store.currentFiles(); }
  folders(): Folder[]   { return this.store.currentFolders(); }
  path(): Folder[]      { return this.store.breadcrumb(); }

  openFolder(id: number) {
    this.router.navigate(['/drive/folder', id]);
  }

  // search debounce
  onSearch(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.search(v), 250);
  }

  // preview helpers
  safe(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }
  isImage(mime: string) { return mime?.startsWith('image/'); }
  isPdf(mime: string)   { return mime === 'application/pdf'; }
  iconFor(mime: string) {
    if (this.isPdf(mime)) return 'picture_as_pdf';
    if (this.isImage(mime)) return 'image';
    if (mime === 'text/plain') return 'description';
    return 'insert_drive_file';
  }

  trackById = (_: number, x: { id: number }) => x.id;
}
