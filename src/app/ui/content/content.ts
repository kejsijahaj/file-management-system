import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { FilePipe } from '../../shared/pipes/file-pipe';
import { SizePipe } from '../../shared/pipes/size-pipe';
import { DriveStore } from '../../features/drive/state/drive-store';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmService } from '../../shared/services/confirm-service';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    FilePipe,
    SizePipe,
  ],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private confirm = inject(ConfirmService);
  store = inject(DriveStore);

  // listen to id changes
  folderId = toSignal(this.route.paramMap.pipe(map((p) => Number(p.get('id') ?? 0))), {
    initialValue: 0,
  });
  parent: any;

  constructor() {
    // load when id changes
    effect(() => {
      const id = this.folderId();
      this.store.load(id);
    });
  }

  async onDeleteFile(id: number, name: string): Promise<void> {
    const confirmed = await this.confirm.confirm(`Delete file`, `Are you sure you want to delete "${name}"? This action cannot be undone.`);

    if (confirmed) {
      try {
        await this.store.deleteFile(id);
      } catch (error) {
        console.error('Error deleting file:', error);
        // can add toaster notif
      }
    }
  }

  async onDeleteFolder(id: number): Promise<void> {
    try {
      await this.store.deleteFolderFlow(id);
    } catch (error) {
      console.error('Error deleting folder:', error);
      // can add toaster notif
    }
  }

  go(id: number) {
    this.router.navigate(['/drive/folder', id]);
  }

  openFile(id: number) {
    console.log('open file', id);
  }
}
