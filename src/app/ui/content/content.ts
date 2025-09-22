import { Component, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { firstValueFrom } from 'rxjs';

import { FilePipe } from '../../shared/pipes/file-pipe';
import { SizePipe } from '../../shared/pipes/size-pipe';
import { DriveStore } from '../../features/drive/state/drive-store';
import { ZipService } from '../../shared/services/zip-service';
import { DownloadService } from '../../shared/services/download-service';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatButtonModule } from '@angular/material/button';
import { ConfirmService } from '../../shared/services/confirm-service';
import { NameDialog } from '../../shared/components/name-dialog/name-dialog';
import { MatDialog } from '@angular/material/dialog';
import { FilePreviewDialog } from '../../shared/components/file-preview-dialog/file-preview-dialog';
import { FileItem } from '../../shared/models/file-model';
import { PermissionService } from '../../features/drive/permission-service';

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
  zip = inject(ZipService);
  download = inject(DownloadService);
  perm = inject(PermissionService);

  dragging = signal<{ id: string; type: 'file' | 'folder' } | null>(null);
  dragOver = signal<string | null>(null);

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

  async onDownloadSelected() {
    if (this.store.selectedCount() === 0) return;

    const files: FileItem[] = this.store.getSelectedFileItems();
    const folderIds: string[] = this.store.getSelectedFolderIds();

    const zipBlob = await this.zip.zipSelection(
      { userId: this.store.userId(), files, folderIds },
      { compressionLevel: 6, concurrency: 6 }
    );

    const name = this.store.suggestBatchZipName();
    await this.download.save(zipBlob, name);
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

  // drag and drop handlers

  private async validDrop(
    targetId: string,
    item: { id: string; type: 'file' | 'folder' }
  ): Promise<boolean> {
    if (item.type === 'file') {
      const file = this.store.filesById().get(item.id);
      if (!this.store['perm'].canEditFile(file)) return false;
      return true;
    } else {
      const folder = this.store.foldersById().get(item.id);
      if (!this.store['perm'].canEditFolder(folder)) return false;
      const invalid = await this.store.isInvalidFolderMoveSingle(item.id, targetId);
      return !invalid;
    }
  }

  onDragStart(event: DragEvent, id: string, type: 'file' | 'folder') {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData('application/json', JSON.stringify({ id, type }));
    event.dataTransfer.effectAllowed = 'move';
    this.dragging.set({ id, type });
  }

  onDragEnd(_event: DragEvent) {
    this.dragging.set(null);
    this.dragOver.set(null);
  }

  async onDragEnter(event: DragEvent, id: string) {
    event.preventDefault();
    try {
      const item = this.readItem(event);
      if (item && (await this.validDrop(id, item))) {
        this.dragOver.set(id);
      }
    } catch {
      // ignore malformed data
    }
  }

  async onDragOver(event: DragEvent, id: string) {
    event.preventDefault();
    const item = this.readItem(event);
    if (!item) return;

    const ok = await this.validDrop(id, item);
    event.dataTransfer && (event.dataTransfer.dropEffect = ok ? 'move' : 'none');
    this.dragOver.set(ok ? id : null);
  }

  onDragLeave(_event: DragEvent, id: string) {
    if (this.dragOver() === id) this.dragOver.set(null);
  }

  async onDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    const item = this.readItem(event);
    if (!item) return;

    if (!(await this.validDrop(targetId, item))) {
      this.snackbar.open('Cannot drop there', '', { duration: 800 });
      this.dragOver.set(null);
      return;
    }

    try {
      if (item.type === 'file') {
        await this.store.moveFile(item.id, targetId);
      } else {
        await this.store.moveFolder(item.id, targetId);
      }
      await this.store['refreshFolderFromServer']?.(targetId);
    } catch (e) {
      console.error('Error during move:', e);
      this.snackbar.open('Failed to move item', '', { duration: 1000 });
    } finally {
      this.dragOver.set(null);
      this.dragging.set(null);
    }
  }

  private readItem(event: DragEvent): { id: string; type: 'file' | 'folder' } | null {
    try {
      const dt = event.dataTransfer;
      if (!dt) return null;
      const raw = dt.getData('application/json') || dt.getData('text/plain');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.id === 'string' &&
        (parsed.type === 'file' || parsed.type === 'folder')
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }
}
