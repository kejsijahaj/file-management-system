import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api/api-service';
import { DriveStore } from '../../features/drive/state/drive-store';

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
  imports: [CommonModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss',
})
export class Sidenav {
  private api = inject(ApiService);
  private router = inject(Router);
  store = inject(DriveStore);

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
    if (node.type === 'folder') {
      await this.router.navigate(['/drive/folder', node.id]);
      return;
    }
    // TODO: file preview / download
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

  // -------- create files and folders --------

  create() {
    console.log('create new file or folder');
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
