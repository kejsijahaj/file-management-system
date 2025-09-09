import { Injectable, signal, computed, effect } from '@angular/core';
import { ApiService } from '../../../core/api/api-service';
import { Folder } from '../../../shared/models/folder-model';
import { FileItem } from '../../../shared/models/file-model';
import { ConfirmService } from '../../../shared/services/confirm-service';

type Id = number;
type SearchHit =
  | { kind: 'folder'; id: number; name: string; parentId: number }
  | {
      parentId: any;
      kind: 'file';
      id: number;
      name: string;
      folderId: number;
      mime?: string;
      size?: number;
      updatedAt?: string;
    };

// small helper
const clone = <K, V>(m: Map<K, V>) => new Map<K, V>(m);

@Injectable({ providedIn: 'root' })
export class DriveStore {
  //session
  userId = signal<Id>(1); // set after login
  currentFolderId = signal<Id>(0); // root

  //UI
  viewMode = signal<'grid' | 'list'>((localStorage.getItem('viewMode') as any) || 'grid');
  query = signal<string>('');
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  //normalized state
  foldersById = signal<Map<Id, Folder>>(new Map());
  filesById = signal<Map<Id, FileItem>>(new Map());

  //fast lookups
  childrenByParent = signal<Map<Id, Id[]>>(new Map()); // parent -> folder
  filesByFolder = signal<Map<Id, Id[]>>(new Map()); // folder -> files

  //derived views
  currentFolders = computed(() => {
    const ids = this.childrenByParent().get(this.currentFolderId()) || [];
    const byId = this.foldersById();
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  });

  currentFiles = computed(() => {
    const ids = this.filesByFolder().get(this.currentFolderId()) || [];
    const byId = this.filesById();
    let rows = ids.map((id) => byId.get(id)!).filter(Boolean);
    const q = this.query().trim().toLowerCase();
    if (q) rows = rows.filter((f) => f.name.toLowerCase().includes(q));
    return rows;
  });

  breadcrumb = signal<Folder[]>([]);

  constructor(private api: ApiService, private confirm: ConfirmService) {
    effect(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('viewMode', this.viewMode());
      }
    });

    effect(() => {
      this.currentFolderId();
      this.clearSelection();
      this.movePicking.set(false);
    });
  }

  // ------- loaders --------
  async load(folderId: Id = this.currentFolderId()) {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.currentFolderId.set(folderId);
      const uid = this.userId();

      // parallel reads
      const [folders, files, path] = await Promise.all([
        this.api.listChildrenFolders(uid, folderId),
        this.api.listFilesInFolder(uid, folderId),
        folderId === 0 ? Promise.resolve([]) : this.api.getFolderPath(folderId),
      ]);

      // upsert folders
      const fMap = clone(this.foldersById());
      for (const f of folders) fMap.set(f.id, f);
      this.foldersById.set(fMap);

      // upsert files
      const fileMap = clone(this.filesById());
      for (const f of files) fileMap.set(f.id, f);
      this.filesById.set(fileMap);

      // set indexes
      const childIdx = clone(this.childrenByParent());
      childIdx.set(
        folderId,
        folders.map((f) => f.id)
      );
      this.childrenByParent.set(childIdx);

      const filesIdx = clone(this.filesByFolder());
      filesIdx.set(
        folderId,
        files.map((f) => f.id)
      );
      this.filesByFolder.set(filesIdx);

      this.breadcrumb.set(path);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load folder');
    } finally {
      this.loading.set(false);
    }
  }

  // ------- search -------
  searchMode = signal<boolean>(false);
  searchResults = signal<SearchHit[]>([]);

  clearSearch() {
    this.query.set('');
    this.searchMode.set(false);
    this.searchResults.set([]);
  }

  async searchGlobal(text: string) {
    const raw = (text ?? '').trim();
    this.query.set(raw);

    if (!raw) {
      this.clearSearch();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const uid = this.userId();

      const [folders, files] = await Promise.all([
        this.api.searchFoldersByName(uid, raw),
        this.api.searchFilesByName(uid, raw),
      ]);

      const qlc = raw.toLowerCase();
      const foldersFiltered = (folders ?? []).filter((f) => f.name?.toLowerCase().includes(qlc));
      const filesFiltered = (files ?? []).filter((f) => f.name?.toLowerCase().includes(qlc));

      const fMap = new Map(this.foldersById());
      for (const f of foldersFiltered) fMap.set(f.id, f);
      this.foldersById.set(fMap);

      const fileMap = new Map(this.filesById());
      for (const f of filesFiltered) fileMap.set(f.id, f);
      this.filesById.set(fileMap);

      const hits: SearchHit[] = [
        ...foldersFiltered.map((f) => ({
          kind: 'folder' as const,
          id: f.id,
          name: f.name,
          parentId: f.parentId,
        })),
        ...filesFiltered.map((f) => ({
          kind: 'file' as const,
          id: f.id,
          name: f.name,
          folderId: f.folderId,
          parentId: f.folderId,
          mime: f.mime,
          size: f.size,
          updatedAt: f.updatedAt,
        })),
      ];

      this.searchResults.set(hits);
      this.searchMode.set(true);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to search');
    } finally {
      this.loading.set(false);
    }
  }

  // ------ index helpers ------
  private _addChild(parentId: Id, folderId: Id) {
    const idx = clone(this.childrenByParent());
    const arr = idx.get(parentId) ?? [];
    idx.set(parentId, [...arr, folderId]);
    this.childrenByParent.set(idx);
  }

  private _removeChild(parentId: Id, folderId: Id) {
    const idx = clone(this.childrenByParent());
    const arr = (idx.get(parentId) ?? []).filter((id) => id !== folderId);
    idx.set(parentId, arr);
    this.childrenByParent.set(idx);
  }

  private _addFileIndex(folderId: Id, fileId: Id) {
    const idx = clone(this.filesByFolder());
    const arr = idx.get(folderId) ?? [];
    idx.set(folderId, [...arr, fileId]);
    this.filesByFolder.set(idx);
  }

  private _removeFileIndex(folderId: Id, fileId: Id) {
    const idx = clone(this.filesByFolder());
    const arr = (idx.get(folderId) ?? []).filter((id) => id !== fileId);
    idx.set(folderId, arr);
    this.filesByFolder.set(idx);
  }

  private _setFilesFor(folderId: Id, files: FileItem[]) {
    const map = clone(this.filesById());
    for (const f of files) map.set(f.id, f);
    this.filesById.set(map);
    const idx = clone(this.filesByFolder());
    idx.set(
      folderId,
      files.map((f) => f.id)
    );
    this.filesByFolder.set(idx);
  }

  private async _deleteFolderOnly(id: Id) {
    await this.api.deleteFolder(id);
    const entity = this.foldersById().get(id);
    if (!entity) return; // cant delete empty folders

    // remove entity
    const fMap = clone(this.foldersById());
    fMap.delete(id);
    this.foldersById.set(fMap);
    // remove from index
    this._removeChild(entity.parentId, id);
  }

  // ------ folder ops --------
  async createFolder(name: string) {
    const now = new Date().toISOString();
    const body = { userId: this.userId(), name, parentId: this.currentFolderId(), createdAt: now };
    const created = await this.api.createFolder(body);

    // upsert and index
    const fMap = clone(this.foldersById());
    fMap.set(created.id, created);
    this.foldersById.set(fMap);
    this._addChild(created.parentId, created.id);
  }

  async renameFolder(id: Id, name: string) {
    const updated = await this.api.renameFolder(id, name);
    const fMap = clone(this.foldersById());
    fMap.set(id, updated);
    this.foldersById.set(fMap);
    if (id === this.currentFolderId()) {
      this.breadcrumb.set(await this.api.getFolderPath(id));
    }
  }

  async moveFolder(id: Id, targetParentId: Id) {
    // read old parent
    const old = this.foldersById().get(id);
    const oldParent = old?.parentId ?? this.currentFolderId();

    const updated = await this.api.moveFolder(id, targetParentId);

    // entity
    const fMap = clone(this.foldersById());
    fMap.set(id, updated);
    this.foldersById.set(fMap);

    // reindex
    this._removeChild(oldParent, id);
    this._addChild(targetParentId, id);

    // breadcrumb refresh
    if (id === this.currentFolderId()) {
      this.breadcrumb.set(await this.api.getFolderPath(id));
    }
  }

  async deleteFolderFlow(id: Id) {
    this.loading.set(true);
    this.error.set(null);
    try {
      const localSubfolders = (this.childrenByParent().get(id) ?? []).length;
      const localFiles = (this.filesByFolder().get(id) ?? []).length;

      let info = {
        folderName: this.foldersById().get(id)?.name ?? 'folder',
        subfolders: localSubfolders,
        files: localFiles,
      };

      if (localSubfolders === 0 && localFiles === 0) {
        const remote = await this.inspectFolder(id);
        info = remote;
      }

      const isEmpty = info.subfolders === 0 && info.files === 0;
      if (isEmpty) {
        await this._deleteFolderOnly(id);
        return;
      }

      // prompt
      const choice = await this.confirm.deleteNonEmptyFolder(info);
      if (choice === 'cascade') {
        await this.cascadeDeleteFolder(id);
      } else {
      }
    } catch (e: any) {
      this.error.set(e?.message ?? 'Delete failed');
    } finally {
      this.loading.set(false);
    }
  }

  async cascadeDeleteFolder(rootId: Id) {
    const uid = this.userId();

    // build sub trees
    const depths = new Map<Id, number>();
    const parentOf = new Map<Id, Id>();
    const allFolders: Id[] = [];

    const queue: Array<{ id: Id; depth: number }> = [{ id: rootId, depth: 0 }];
    depths.set(rootId, 0);
    parentOf.set(rootId, this.foldersById().get(rootId)?.parentId ?? 0);

    while (queue.length) {
      const { id, depth } = queue.shift()!;
      allFolders.push(id);

      const children = await this.api.listChildrenFolders(uid, id);
      for (const c of children) {
        depths.set(c.id, depth + 1);
        parentOf.set(c.id, c.parentId);
        queue.push({ id: c.id, depth: depth + 1 });

        const fm = new Map(this.foldersById());
        fm.set(c.id, c);
        this.foldersById.set(fm);
        const idx = new Map(this.childrenByParent());
        const arr = idx.get(id) ?? [];
        if (!arr.includes(c.id)) idx.set(id, [...arr, c.id]);
        this.childrenByParent.set(idx);
      }
    }

    allFolders.sort((a, b) => depths.get(b)! - depths.get(a)!);

    for (const fid of allFolders) {
      // delete files in this folder
      const files = await this.api.listFilesInFolder(uid, fid);
      if (files.length) {
        await Promise.all(
          files.map(async (f) => {
            await this.api.deleteFile(f.id);

            const m = new Map(this.filesById());
            m.delete(f.id);
            this.filesById.set(m);
            this._removeFileIndex(fid, f.id);
          })
        );
      }

      // delete folder
      await this.api.deleteFolder(fid);

      // update store
      const fm = new Map(this.foldersById());
      fm.delete(fid);
      this.foldersById.set(fm);

      const parentId = parentOf.get(fid) ?? 0;
      this._removeChild(parentId, fid);
    }
  }

  async inspectFolder(id: Id): Promise<{ folderName: string; subfolders: number; files: number }> {
    const uid = this.userId();
    const root = await this.api.getFolder(id);
    const queue: Id[] = [id];
    const seen = new Set<Id>([id]);
    let subfolderCount = 0;
    let fileCount = 0;

    while (queue.length) {
      const fid = queue.shift()!;
      // children
      const children = await this.api.listChildrenFolders(uid, fid);
      for (const c of children) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          queue.push(c.id);
          subfolderCount++;
        }
      }

      // files in this folder
      const files = await this.api.listFilesInFolder(uid, fid);
      fileCount += files.length;
    }

    return {
      folderName: root.name,
      subfolders: subfolderCount,
      files: fileCount,
    };
  }

  // ------- file ops -----

  private fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async uploadFile(file: File) {
    const now = new Date().toISOString();
    const dataUrl = await this.fileToDataUrl(file);
    const body: Omit<FileItem, 'id'> = {
      userId: this.userId(),
      folderId: this.currentFolderId(),
      name: file.name,
      mime: file.type,
      size: file.size,
      url: dataUrl,
      createdAt: now,
      updatedAt: now,
    };

    const created = await this.api.createFile(body);

    // upset + index
    const map = clone(this.filesById());
    map.set(created.id, created);
    this.filesById.set(map);
    this._addFileIndex(created.folderId, created.id);
  }

  async renameFile(id: Id, newName: string) {
    const updated = await this.api.patchFile(id, {
      name: newName,
      updatedAt: new Date().toISOString(),
    });
    const map = clone(this.filesById());
    map.set(id, updated);
    this.filesById.set(map);
  }

  async moveFile(id: Id, targetFolderId: Id) {
    const old = this.filesById().get(id);
    const oldFolder = old?.folderId ?? this.currentFolderId();

    const updated = await this.api.moveFile(id, targetFolderId);

    const map = clone(this.filesById());
    map.set(id, updated);
    this.filesById.set(map);
    this._removeFileIndex(oldFolder, id);
    this._addFileIndex(targetFolderId, id);
  }

  async deleteFile(id: Id) {
    await this.api.deleteFile(id);
    const entity = this.filesById().get(id);
    if (!entity) return;

    const map = clone(this.filesById());
    map.delete(id);
    this.filesById.set(map);
    this._removeFileIndex(entity.folderId, id);
  }

  // ------- batch operations -------

  selectedFileIds = signal<Set<Id>>(new Set());
  selectedFolderIds = signal<Set<Id>>(new Set());

  selectedCount = computed(() => this.selectedFileIds().size + this.selectedFolderIds().size);

  clearSelection() {
    this.selectedFileIds.set(new Set());
    this.selectedFolderIds.set(new Set());
  }

  isFileSelected(id: Id) {
    return this.selectedFileIds().has(id);
  }

  isFolderSelected(id: Id) {
    return this.selectedFolderIds().has(id);
  }

  toggleFile(id: Id) {
    const set = new Set(this.selectedFileIds());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedFileIds.set(set);
  }

  toggleFolder(id: Id) {
    const set = new Set(this.selectedFolderIds());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedFolderIds.set(set);
  }

  selectAllVisible() {
    const files = this.searchMode()
      ? this.searchResults()
          .filter((h) => h.kind === 'file')
          .map((h) => h.id)
      : this.currentFiles().map((f) => f.id);
    const folders = this.searchMode()
      ? this.searchResults()
          .filter((h) => h.kind === 'folder')
          .map((h) => h.id)
      : this.currentFolders().map((f) => f.id);
    this.selectedFileIds.set(new Set(files));
    this.selectedFolderIds.set(new Set(folders));
  }

  async deleteSelected() {
    if (this.selectedCount() === 0) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await Promise.all([...this.selectedFileIds()].map((id) => this.deleteFile(id)));
      for (const fid of this.selectedFolderIds()) {
        await this.deleteFolderFlow(fid);
      }
      this.clearSelection();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Delete failed');
    } finally {
      this.loading.set(false);
    }
  }

  async moveSelected(targetFolderId: Id) {
    if (this.selectedCount() === 0) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      await Promise.all([...this.selectedFileIds()].map((id) => this.moveFile(id, targetFolderId)));
      for (const fid of this.selectedFolderIds()) {
        await this.moveFolder(fid, targetFolderId);
      }
      this.clearSelection();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Move failed');
    } finally {
      this.loading.set(false);
    }
  }

  // move helpers

  movePicking = signal<boolean>(false);
  moveHint = signal<string>('Pick a folder to move here');

  startMovePick() {
    this.movePicking.set(true);
  }
  cancelMovePick() {
    this.movePicking.set(false);
  }

  private async _isInvalidTarget(targetId: Id): Promise<boolean> {
    for (const fid of this.selectedFolderIds()) {
      if (targetId === fid) return true;

      const path = await this.api.getFolderPath(targetId);
      if (path.some((p) => p.id === fid)) return true;
    }
    return false;
  }

  async pickMoveTarget(targetFolderId: Id) {
    if (!(await this._isInvalidTarget(targetFolderId))) {
      await this.moveSelected(targetFolderId);
      this.movePicking.set(false);
    } else {
      this.error.set('Cannnot move into the same or descendant folder.');
    }
  }
}
