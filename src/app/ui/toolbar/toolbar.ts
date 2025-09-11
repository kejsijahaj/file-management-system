import { Component, effect, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { DriveStore } from '../../features/drive/state/drive-store';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-toolbar',
  imports: [MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatButtonToggleModule],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class Toolbar {
  store = inject(DriveStore);
  router = inject(Router);
  private timer?: any;

  setViewMode(mode: ViewMode) {
    this.store.viewMode.set(mode);
  }

  onSearchInput(v: string) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.store.searchGlobal(v), 300);
  }

  clearSearch() {
    this.store.clearSearch();
  }

  go(id: string) {
    this.router.navigate(['/drive/folder', id]);
  }
}
