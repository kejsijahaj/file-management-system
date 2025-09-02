import { Component, effect, inject } from '@angular/core';
import { RouterLink, Router } from '@angular/router';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { DriveStore } from '../../features/drive/state/drive-store';

type ViewMode = 'list' | 'grid';

@Component({
  selector: 'app-toolbar',
  imports: [MatIconModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './toolbar.html',
  styleUrl: './toolbar.scss',
})
export class Toolbar {
  store = inject(DriveStore);
  router = inject(Router);

  go(id: number) {
    this.router.navigate(['/drive/folder', id]);
  }
}
