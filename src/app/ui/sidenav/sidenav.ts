import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuItem, MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';

import { DriveStore } from '../../features/drive/state/drive-store';
import { UnzipService } from '../../shared/services/unzip-service';
import { NameDialog, NameDialogData } from '../../shared/components/name-dialog/name-dialog';
import { PermissionService } from '../../features/drive/permission-service';

type NodeType = 'folder' | 'file';
interface NodeItem {
  id: string;
  name: string;
  type: NodeType;
  mime?: string;
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatMenuItem,
    MatMenuModule,
  ],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss',
})
export class Sidenav {
  private router = inject(Router);
  private dialog = inject(MatDialog);
  private snackbar = inject(MatSnackBar);
  private unzip = inject(UnzipService);
  store = inject(DriveStore);
  perm = inject(PermissionService)

  canUpload = () => this.perm.canUpload();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  // UI-only state
  expanded = signal(new Set<string>(['0']));
  loadingIds = signal(new Set<string>());

  constructor() {
    this.store.load('0');
  }

  // ---------- derive children directly from the store ----------
  foldersOf(parentId: string): NodeItem[] {
    const key = String(parentId);
    const ids = this.store.childrenByParent().get(key);
    if (ids) {
      return ids
        .map((id) => this.store.foldersById().get(id))
        .filter(Boolean)
        .map((f) => ({ id: String(f!.id), name: f!.name, type: 'folder' as const }));
    }
    // fallback scan when index isn't primed yet
    return Array.from(this.store.foldersById().values())
      .filter((f) => f.parentId === key)
      .map((f) => ({ id: String(f.id), name: f.name, type: 'folder' as const }));
  }

  filesOf(folderId: string): NodeItem[] {
    const key = String(folderId);
    const ids = this.store.filesByFolder().get(key);
    if (ids) {
      return ids
        .map((id) => this.store.filesById().get(id))
        .filter(Boolean)
        .map((f) => ({ id: String(f!.id), name: f!.name, type: 'file' as const, mime: f!.mime }));
    }
    return Array.from(this.store.filesById().values())
      .filter((f) => f.folderId === key)
      .map((f) => ({ id: String(f.id), name: f.name, type: 'file' as const, mime: f.mime }));
  }

  childrenOf(id: string): NodeItem[] {
    return [...this.foldersOf(id), ...this.filesOf(id)];
  }

  // ---------- UI actions ----------
  isExpanded = (id: string | number) => this.expanded().has(String(id));
  isLoading = (id: string) => this.loadingIds().has(String(id));

  private setExpanded(id: string, open: boolean) {
    const next = new Set(this.expanded());
    open ? next.add(id) : next.delete(id);
    this.expanded.set(next);
  }

  private setLoading(id: string, on: boolean) {
    const next = new Set(this.loadingIds());
    on ? next.add(id) : next.delete(id);
    this.loadingIds.set(next);
  }

  async toggleFolder(id: string) {
    const open = this.isExpanded(id);
    if (!open) {
      if (!this.store.childrenByParent().has(id) || !this.store.filesByFolder().has(id)) {
        this.setLoading(id, true);
        try {
          await this.store.load(id);
        } finally {
          this.setLoading(id, false);
        }
      }
    }
    this.setExpanded(id, !open);
  }

  async openFolder(id: string) {
    if (this.store.movePicking()) {
      await this.store.pickMoveTarget(id);
      return;
    }
    await this.router.navigate(['/drive/folder', id]);
  }

  // -------- create/upload --------

  openCreateDialog(type: 'folder' | 'file') {
    const dialogConfig = {
      data: {
        title: type === 'folder' ? 'Create New Folder' : 'Create New File',
        label: type === 'folder' ? 'Folder Name' : 'File Name',
      } as NameDialogData,
      width: '400px',
    };
    const ref = this.dialog.open(NameDialog, dialogConfig);
    ref.afterClosed().subscribe(async (name: string | undefined) => {
      if (!name) return;
      try {
        if (type === 'folder') {
          await this.store.createFolder(name);
        }
      } catch (err) {
        console.error(`Failed to create ${type}:`, err);
        this.snackbar.open(`Failed to create ${type}`, '', { duration: 1200 });
      }
    });
  }

  openFilePicker() {
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
    this.fileInput.nativeElement.click();
  }

  async onFilesPicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    for (const file of files) {
      const isZip = file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip');
      if (isZip) {
        try {
          await this.unzip.extractZipUpload(file, {
            parentFolderId: this.store.currentFolderId(),
            useCommonTopLevel: true,
            onProgress: (pct) => {/*maybe add progress bar*/}
          });
        } catch (e) {
          console.error('Unzip failed', e);
          this.store.error.set((e as Error)?.message ?? 'Failed to extract ZIP');
          this.snackbar.open(this.store.error()!, 'Close', { duration: 3000 });
        }
      } else {
        await this.store.uploadFile(file);
      }
    }
    input.value = '';
  }

  // trackBy
  trackNode = (_: number, n: NodeItem) => n.type + ':' + n.id;
}
