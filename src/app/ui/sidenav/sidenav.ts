import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TrackByFunction } from '@angular/core';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { ApiService } from '../../core/api/api-service';
import { DriveStore } from '../../features/drive/state/drive-store';
import { BehaviorSubject, forkJoin, switchMap } from 'rxjs';
import {toSignal} from "@angular/core/rxjs-interop"

type NodeType = 'folder' | 'file';

interface TreeNode {
  id: number;
  name: string;
  type: NodeType;
  mime?: string;
  children?: TreeNode[];
  hasChildren?: boolean;
  loaded?: boolean;
  loading?: boolean;
}

@Component({
  selector: 'app-sidenav',
  imports: [MatButtonModule, MatTreeModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './sidenav.html',
  styleUrl: './sidenav.scss',
})
export class Sidenav {
  private api = inject(ApiService);
  store = inject(DriveStore);
  private router = inject(Router);

  readonly #getData = new BehaviorSubject<void>(undefined);
  readonly #data$ = this.#getData.asObservable().pipe(switchMap(() => {
    return forkJoin([
        this.api.listChildrenFolders(this.store.userId(), 0),
        this.api.listFilesInFolder(this.store.userId(), 0),
      ])
  }))
  readonly #data = toSignal(this.#data$)

  private expandedIds = signal(new Set<number>([0]));


  protected readonly data = linkedSignal<TreeNode[]>(() => {
    const folders: TreeNode[] = (this.#data()?.[0] ?? []).map(f => ({id: f.id,
        name: f.name,
        type: 'folder' as const,
        children: <TreeNode[]>[],
        loaded: false,}))
    const files: TreeNode[] = (this.#data()?.[1] ?? []).map(f => ({
          id: f.id,
          name: f.name,
          type: 'file' as const,
          mime: f.mime,
        }))
    

    return [
    {
      id: 0,
      name: 'My Drive',
      type: 'folder',
      children: [...folders, ...files],
              // loaded: false,
    },
  ]
  });
  nodesEff = effect(() => console.log(`nodes chnged ${JSON.stringify(this.data())}`))

  childrenOf = (n: TreeNode) => (n.type === 'folder' ? n.children ?? [] : []);
  trackByNode: TrackByFunction<TreeNode> = (_i, node) => `${node.type}:${node.id}`;

  isFolder = (_: number, n: TreeNode) => n.type === 'folder';
  isFile = (_: number, n: TreeNode) => n.type === 'file';

  expanded = (n: TreeNode) => this.expandedIds().has(n.id);


  ngOnInit() {
    // this.loadChildren(this.data()[0]);
    // this.toggle(this.data()[0], true);
  }

  toggle(node: TreeNode, forceOpen?: boolean) {
    // if (node.type !== 'folder') return;

    // const next = new Set(this.expandedIds());
    // const wantOpen = forceOpen ?? !next.has(node.id);

    // if (wantOpen && !node.loaded) {
    //   // await this.loadChildren(node);
    //   this.#getData.next()
    // }

    // if (wantOpen) next.add(node.id);
    // else next.delete(node.id);

    // this.expandedIds.set(next);
    // // this.refresh();
    // this.data.update(n => [...n])

      if (node.type !== 'folder') return;
  const next = new Set(this.expandedIds());
  if (next.has(node.id)) next.delete(node.id);
  else next.add(node.id);
  this.expandedIds.set(next);
  }

  async open(node: TreeNode) {
    if (node.type === 'folder') {
      await this.router.navigate(['/drive/folder', node.id]);
      await this.store.load(node.id);
    } else {
      // show preview
    }
  }

  // private refresh() {
  //   // this.data() = [...this.data()];
  // }
}
