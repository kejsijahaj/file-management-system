import { Component, effect, inject } from '@angular/core';
import { RouterLink, Router, ActivatedRoute} from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DriveStore } from '../../features/drive/state/drive-store';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-toolbar',
  imports: [MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, RouterLink],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss'
})
export class Toolbar {
  private store = inject(DriveStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  viewMode = this.store.viewMode;     // 'grid' | 'list'
  query = this.store.query;           // string
  loading = this.store.loading;       // boolean
  error = this.store.error;           // string | null

  breadcrumb = () => this.store.breadcrumb();
  folders = () => this.store.currentFolders(); // Folder[]
  files = () => this.store.currentFiles();     // File[] (already filtered by query)

  async openCrumb(id: number) {
    await this.router.navigate(['/drive/folder', id]);
    await this.store.load(id);
  }

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
}
