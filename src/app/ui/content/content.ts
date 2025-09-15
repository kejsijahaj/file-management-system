import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { FilePipe } from '../../shared/pipes/file-pipe';
import { SizePipe } from '../../shared/pipes/size-pipe';
import { DriveStore } from '../../features/drive/state/drive-store';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmService } from '../../shared/services/confirm-service';
import { NameDialog } from '../../shared/components/name-dialog/name-dialog';
import { MatDialog } from '@angular/material/dialog';
import { FilePreviewDialog } from '../../shared/components/file-preview-dialog/file-preview-dialog';

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
  private dialog = inject(MatDialog);
  store = inject(DriveStore);
  snackbar = inject(MatSnackBar);

  // listen to id changes
  folderId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id') ?? '0')), {
    initialValue: '0',
  });
  parent: any;

  constructor() {
    // load when id changes
    effect(() => {
      const id = this.folderId();
      this.store.load(id);
    });
  }

  async onDeleteFile(id: string, name: string): Promise<void> {
    const confirmed = await this.confirm.confirm(
      `Delete file`,
      `Are you sure you want to delete "${name}"? This action cannot be undone.`
    );

    if (confirmed) {
      try {
        await this.store.deleteFile(id);
      } catch (error) {
        console.error('Error deleting file:', error);
        this.snackbar.open(`Couldn't delete file`, '', { duration: 800 });
      }
    }
  }

  async onDeleteFolder(id: string): Promise<void> {
    try {
      await this.store.deleteFolderFlow(id);
    } catch (error) {
      console.error('Error deleting folder:', error);
      this.snackbar.open(`Couldn't delete folder`, '', { duration: 800 });
    }
  }

  onDeleteSelected() {
    this.store.deleteSelected();
  }

  async onEditFolder(folder: { id: string; name: string }) {
    const ref = this.dialog.open(NameDialog, {
      width: '400px',
      data: {
        title: 'Rename Folder',
        label: 'New Name',
        placeholder: folder.name,
        confirm: 'Rename',
      },
    });
    const newName: string | undefined = await firstValueFrom(ref.afterClosed());
    if (!newName || newName.trim() === '' || newName === folder.name) return;
    await this.store.renameFolder(folder.id, newName.trim());
  }

  async onEditFile(file: { id: string; name: string }) {
    const ref = this.dialog.open(NameDialog, {
      width: '400px',
      data: {
        title: 'Rename File',
        label: 'New Name',
        placeholder: file.name,
        confirm: 'Rename',
      },
    });
    const newName: string | undefined = await firstValueFrom(ref.afterClosed());
    if (!newName || newName.trim() === '' || newName === file.name) return;

    await this.store.renameFile(file.id, newName.trim());
  }

  go(id: string) {
    this.router.navigate(['/drive/folder', id]);
  }

  openFile(id: string) {
    const file = this.store.filesById().get(id);
    if (!file) return;

    this.dialog.open(FilePreviewDialog, {
      data: { file },
      panelClass: 'preview-dialog',
      width: '80vw',
      maxWidth: '80vw',
      height: '80vh',
    });
  }
}
