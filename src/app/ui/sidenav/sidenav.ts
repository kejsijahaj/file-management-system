import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';

import { ApiService } from '../../core/api/api-service';
import { DriveStore } from '../../features/drive/state/drive-store';
import { MatMenuItem, MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { NameDialog, NameDialogData } from '../../shared/components/name-dialog/name-dialog';

type NodeType = 'folder' | 'file';

interface NodeItem {
  id: string;
  name: string;
  type: NodeType;
  mime?: string;
  children?: NodeItem[];
  loaded?: boolean;
  loading?: boolean;
  error?: string;
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
  private api = inject(ApiService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  store = inject(DriveStore);
  snackbar = inject(MatSnackBar);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  root = signal<NodeItem>({
    id: '0',
    name: 'My Drive',
    type: 'folder',
    children: [],
    loaded: false,
    loading: false,
  });

  expanded = signal(new Set<string>());

  // ---------------- lifecycle ----------------
  async ngOnInit() {
    await this.loadFolderById(this.root().id);
    this.setExpanded(this.root().id, true);
  }

  // ---------------- UI ----------------
  async toggle(node: NodeItem) {
    if (node.type !== 'folder') return;
    const open = this.isExpanded(node.id);
    if (!open) {
      const current = this.findNodeById(this.root(), node.id);
      if (current && !current.loaded) {
        await this.loadFolderById(node.id);
      }
    }
    this.setExpanded(node.id, !open);
  }

  async open(node: NodeItem) {
    if (node.type !== 'folder') return;
    if (this.store.movePicking()) {
      await this.store.pickMoveTarget(Number(node.id));
      return;
    }
    await this.router.navigate(['/drive/folder', node.id]);
  }

  // ---------------- data loading ----------------
  private async loadFolderById(id: string) {
    this.mutateNode(id, (n) => {
      if (n.type !== 'folder') return;
      if (n.loading) return;
      n.loading = true;
      n.error = undefined;
    });

    try {
      const uid = Number(this.store.userId());
      const parent = Number(id);

      const [folders, files] = await Promise.all([
        this.api.listChildrenFolders(uid, parent),
        this.api.listFilesInFolder(uid, parent),
      ]);

      this.mutateNode(id, (n) => {
        if (n.type !== 'folder') return;
        n.children = [
          ...folders.map((f: any) => ({
            id: String(f.id),
            name: f.name,
            type: 'folder' as const,
            children: [],
            loaded: false,
            loading: false,
          })),
          ...files.map((f: any) => ({
            id: String(f.id),
            name: f.name,
            type: 'file' as const,
            mime: f.mime,
          })),
        ];
        n.loaded = true;
      });
    } catch (err: any) {
      this.mutateNode(id, (n) => {
        if (n.type !== 'folder') return;
        n.children = n.children ?? [];
        n.loaded = true;
        n.error = err?.message ?? 'Failed to load';
      });
    } finally {
      this.mutateNode(id, (n) => {
        if (n.type !== 'folder') return;
        n.loading = false;
      });
    }
  }

  // -------- upload files and create folders --------

  openCreateDialog(type: 'folder' | 'file') {
    const dialogConfig = {
      data: {
        title:type === 'folder' ? 'Create New Folder' : 'Create New File',
        label: type === 'folder' ? 'Folder Name' : 'File Name',
      } as NameDialogData,
      width: '400px',
    };

    const dialogRef = this.dialog.open(NameDialog, dialogConfig);

    dialogRef.afterClosed().subscribe(async (name: string | undefined) => {
      if (!name) return;

      try {
        if (type === 'folder') {
          await this.store.createFolder(name);
        }
      } catch (error) {
        console.error(`Failed to create ${type}:`, error);
        this.snackbar.open(`Failed to create folder`, '',{duration: 800});
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
    if (!files.length) return;

    try {
      for (const file of files) {
        await this.store.uploadFile(file);
      }
    } finally {
      input.value = '';
    }
  }

  // ---------------- helpers ----------------
  isExpanded = (id: string | number) => this.expanded().has(String(id));

  private setExpanded(id: string | number, open: boolean) {
    const next = new Set(this.expanded());
    open ? next.add(String(id)) : next.delete(String(id));
    this.expanded.set(next);
  }

  private bump() {
    this.root.set({ ...this.root() });
  }

  private findNodeById(root: NodeItem, id: string): NodeItem | null {
    if (root.id === id) return root;
    const kids = root.children ?? [];
    for (const c of kids) {
      if (c.id === id) return c;
      if (c.type === 'folder') {
        const hit = this.findNodeById(c, id);
        if (hit) return hit;
      }
    }
    return null;
  }

  private mutateNode(id: string, fn: (n: NodeItem) => void) {
    const current = this.root();
    const node = this.findNodeById(current, id);
    if (!node) return;
    fn(node);
    this.root.set({ ...current });
  }
}
