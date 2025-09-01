import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { DriveStore } from '../../features/drive/state/drive-store';
import { Sidenav } from '../sidenav/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule
],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  store = inject(DriveStore);

  // listen to id changes
  folderId = toSignal(this.route.paramMap.pipe(map(p => Number(p.get('id') ?? 0))), { initialValue: 0});

  constructor() {
    // load when id changes
    effect(() => {
      const id = this.folderId();
      this.store.load(id);
    });
  }

  go(id: number) {
    this.router.navigate(['/drive/folders', id]);
  }

  openFile(id: number) {
    console.log('open file', id);
  }
}
