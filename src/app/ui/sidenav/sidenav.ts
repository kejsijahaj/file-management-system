import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrackByFunction } from '@angular/core';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api/api-service';
import { DriveStore } from '../../features/drive/state/drive-store';

type NodeType = 'folder' | 'file';

interface TreeNode {
  id: number;
  name: string;
  type: NodeType;
  mime?: string;
  children?:TreeNode[]
  hasChildren?: boolean;
  loaded?: boolean;
  loading?: boolean;
}

@Component({
  selector: 'app-sidenav',
  imports: [MatButtonModule, MatTreeModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss'
})
export class Sidenav {
  private api = inject(ApiService);
  store = inject(DriveStore);
  private router = inject(Router);

  data: TreeNode[] = [{
    id: 0, name: 'My Drive', type: 'folder', children: [], loaded: false
  }];

  childrenOf = (n: TreeNode) => n.children ?? [];
  trackByNode: TrackByFunction<TreeNode> = (_index, node) => node.id;

  isFolder = (_: number, n: TreeNode) => n.type === 'folder';
  isFile = (_: number, n: TreeNode) => n.type === 'file';

  private expandedIds = signal(new Set<number>());
  expanded = (n: TreeNode) => this.expandedIds().has(n.id);

  async ngOnInit() {
    await this.loadChildren(this.data[0]);
    this.toggle(this.data[0], true);
  }

  async toggle(node: TreeNode, forceOpen?: boolean) {
    if (node.type !== 'folder') return;

    const next = new Set(this.expandedIds());
    const wantOpen = forceOpen ?? !next.has(node.id);

    if(wantOpen && !node.loaded) {
      await this.loadChildren(node);
    }

    if(wantOpen) next.add(node.id);
    else next.delete(node.id);

    this.expandedIds.set(next);
    this.refresh();
  }

  async loadChildren(node: TreeNode) {
    node.loading = true; this.refresh()
    try {
      const uid = this.store.userId();
      const [folders, files] = await Promise.all([
        this.api.listChildrenFolders(uid, node.id),
        this.api.listFilesInFolder(uid, node.id)
      ]);

      node.children = [
        ...folders.map(f => ({id: f.id, name: f.name, type: 'folder' as const, children: []})),
        ...files.map(f => ({id: f.id, name: f.name, type: 'file' as const, mime: f.mime}))
      ];

      node.loaded = true;
    } finally {
      node.loading = false;
      this.refresh();
    }
  }

  async open(node: TreeNode) {
    if(node.type === 'folder') {
      await this.router.navigate(['/drive/folder', node.id]);
      await this.store.load(node.id);
    } else {
      // show preview
    }
  }

  private refresh() {
    this.data = [...this.data];
  }
}
