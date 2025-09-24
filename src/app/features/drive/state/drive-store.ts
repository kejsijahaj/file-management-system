import { Injectable, signal, computed, effect } from '@angular/core';
import { ApiService } from '../../../core/api/api-service';
import { Folder } from '../../../shared/models/folder-model';
import { FileItem } from '../../../shared/models/file-model';
import { ConfirmService } from '../../../shared/services/confirm-service';
import { ZipService } from '../../../shared/services/zip-service';
import { PermissionService } from '../permission-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth-service';

type Id = string;
type SearchHit =
  | { kind: 'folder'; id: string; name: string; parentId: string }
  | {
      parentId: any;
      kind: 'file';
      id: string;
      name: string;
      folderId: string;
      mime?: string;
      size?: number;
      updatedAt?: string;
    };

// small helper
const clone = <K, V>(m: Map<K, V>) => new Map<K, V>(m);

@Injectable({ providedIn: 'root' })
export class DriveStore {
  //session
  userId = signal<string>(''); // set after login
  currentFolderId = signal<Id>('0'); // root

  //UI
  viewMode = signal<'grid' | 'list'>((localStorage.getItem('viewMode') as any) || 'grid');
  query = signal<string>('');
  loading = signal<boolean>(false);
  error = signal<string | null>(null);

  //normalized state
  foldersById = signal<Map<Id, Folder>>(new Map());
  filesById = signal<Map<Id, FileItem>>(new Map());

  private sid(v: unknown): string {
    return String(v);
  }

  private nFolder = (f: any): Folder => ({
    ...f,
    id: this.sid(f.id),
    userId: f.userId,
    parentId: this.sid(f.parentId),
  });

  private nFile = (f: any): FileItem => ({
    ...f,
    id: this.sid(f.id),
    userId: f.userId,
    folderId: this.sid(f.folderId),
    size: Number(f.size ?? 0),
  });

  //fast lookups
  childrenByParent = signal<Map<Id, Id[]>>(new Map()); // parent -> folder
  filesByFolder = signal<Map<Id, Id[]>>(new Map()); // folder -> files

  //derived views
  currentFolders = computed(() => {
    const ids = this.childrenByParent().get(this.currentFolderId()) || [];
    const byId = this.foldersById();
    return ids.map((id) => byId.get(id)!).filter(Boolean);
  });

  localFilter = signal<string>('');

  currentFiles = computed(() => {
    const ids = this.filesByFolder().get(this.currentFolderId()) || [];
    const byId = this.filesById();
    let rows = ids.map((id) => byId.get(id)!).filter(Boolean);
    const q = this.localFilter().trim().toLowerCase();
    if (q) rows = rows.filter((f) => f.name?.toLowerCase().includes(q));
    return rows;
  });

  breadcrumb = signal<Folder[]>([]);

  constructor(
    private api: ApiService,
    private confirm: ConfirmService,
    private zip: ZipService,
    private perm: PermissionService,
    private snackbar: MatSnackBar,
    private auth: AuthService
  ) {
    effect(() => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('viewMode', this.viewMode());
      }
    });

    effect(() => {
      const u = this.auth.getCurrentUser();
      this.userId.set(u ? String(u.id) : '')
    })

    effect(() => {
      this.currentFolderId();
      this.clearSelection();
      this.movePicking.set(false);
    });
  }

  // ------- loaders --------

  loadedFolderIds = signal<Set<string>>(new Set());

  async load(folderId: Id = this.currentFolderId()) {
    console.log(this.currentFolderId(), 'current');
    this.loading.set(true);
    this.error.set(null);
    try {
      this.currentFolderId.set(folderId);
      const uid = this.userId();

      // parallel reads
      const [foldersRaw, filesRaw, pathRaw] = await Promise.all([
        this.api.listChildrenFolders(folderId),
        this.api.listFilesInFolder(folderId),
        folderId === '0' ? Promise.resolve([]) : this.api.getFolderPath(folderId),
      ]);

      const folders = foldersRaw.map(this.nFolder);
      const files = filesRaw.map(this.nFile);
      const path = pathRaw.map(this.nFolder);

      // upsert folders
      const fMap = new Map(this.foldersById());
      folders.forEach((f) => fMap.set(f.id, f));
      this.foldersById.set(fMap);

      // upsert files
      const fileMap = new Map(this.filesById());
      files.forEach((f) => fileMap.set(f.id, f));
      this.filesById.set(fileMap);

      // set indexes
      const childIdx = new Map(this.childrenByParent());
      childIdx.set(
        this.currentFolderId(),
        folders.map((f) => f.id)
      );
      this.childrenByParent.set(childIdx);

      const filesIdx = new Map(this.filesByFolder());
      filesIdx.set(
        this.currentFolderId(),
        files.map((f) => f.id)
      );
      this.filesByFolder.set(filesIdx);

      const s = new Set(this.loadedFolderIds());
      s.add(String(folderId));
      this.loadedFolderIds.set(s);

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
        this.api.searchFoldersByName( raw),
        this.api.searchFilesByName( raw),
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
    const key = String(parentId);
    const idx = new Map(this.childrenByParent());
    const arr = idx.get(key) ?? [];
    idx.set(key, [...arr, folderId]);
    this.childrenByParent.set(idx);
  }

  private _removeChild(parentId: Id, folderId: Id) {
    const key = String(parentId);
    const idx = new Map(this.childrenByParent());
    const arr = (idx.get(key) ?? []).filter((id) => id !== folderId);
    idx.set(key, arr);
    this.childrenByParent.set(idx);
  }

  private _addFileIndex(folderId: Id, fileId: Id) {
    const key = String(folderId);
    const idx = new Map(this.filesByFolder());
    const arr = idx.get(key) ?? [];
    idx.set(key, [...arr, fileId]);
    this.filesByFolder.set(idx);
  }

  private _removeFileIndex(folderId: Id, fileId: Id) {
    const key = String(folderId);
    const idx = new Map(this.filesByFolder());
    const arr = (idx.get(key) ?? []).filter((id) => id !== fileId);
    idx.set(key, arr);
    this.filesByFolder.set(idx);
  }

  private _setFilesFor(folderId: Id, files: FileItem[]) {
    const map = new Map(this.filesById());
    for (const f of files) map.set(f.id, f);
    this.filesById.set(map);
    const idx = new Map(this.filesByFolder());
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
    const fMap = new Map(this.foldersById());
    fMap.delete(id);
    this.foldersById.set(fMap);
    // remove from index
    this._removeChild(entity.parentId, id);
  }

  // ------ folder ops --------
  async createFolder(name: string) {
    const body = {
      userId: this.userId(),
      name,
      parentId: this.currentFolderId(),
      createdAt: new Date().toISOString(),
    };
    const created = this.nFolder(await this.api.createFolder(body));
    const fMap = new Map(this.foldersById());
    fMap.set(created.id, created);
    this.foldersById.set(fMap);
    this._addChild(created.parentId, created.id);
  }

  async renameFolder(id: Id, name: string) {
    const f = this.foldersById().get(id);
    if (!this.perm.canEditFolder(f)) {
      this.snackbar.open('You do not have permission to rename this folder.', 'Close', {
        duration: 3000,
      });
      throw new Error('No permission to rename folder');
    }
    const updated = await this.api.renameFolder(id, name);
    const fMap = clone(this.foldersById());
    fMap.set(id, updated);
    this.foldersById.set(fMap);
    if (id === this.currentFolderId()) {
      this.breadcrumb.set(await this.api.getFolderPath(id));
    }
  }

  async moveFolder(id: Id, targetParentId: Id) {
    const old = this.foldersById().get(id);
    if (!this.perm.canEditFolder(old)) {
      this.snackbar.open('You do not have permission to move this folder.', 'Close', {
        duration: 3000,
      });
      throw new Error('No permission to move folder');
    }
    const oldParent = old?.parentId ?? this.currentFolderId();
    const updated = this.nFolder(await this.api.moveFolder(id, targetParentId));
    const fMap = new Map(this.foldersById());
    fMap.set(updated.id, updated);
    this.foldersById.set(fMap);
    this._removeChild(oldParent, id);
    this._addChild(targetParentId, id);
  }

  async deleteFolderFlow(id: Id) {
    const f = this.foldersById().get(id);
    if (!this.perm.canEditFolder(f)) {
      this.snackbar.open('You do not have permission to delete this folder.', 'Close', {
        duration: 3000,
      });
      throw new Error('No permission to delete folder');
    }
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
    const root = this.foldersById().get(rootId);
    if (!this.perm.canEditFolder(root)) {
      this.snackbar.open('You do not have permission to delete this folder.', 'Close', {
        duration: 3000,
      });
      throw new Error('No permission to delete folder');
    }

    // build sub trees
    const depths = new Map<Id, number>();
    const parentOf = new Map<Id, Id>();
    const allFolders: Id[] = [];

    const queue: Array<{ id: Id; depth: number }> = [{ id: rootId, depth: 0 }];
    depths.set(rootId, 0);
    parentOf.set(rootId, this.foldersById().get(rootId)?.parentId ?? '0');

    while (queue.length) {
      const { id, depth } = queue.shift()!;
      allFolders.push(id);

      const children = await this.api.listChildrenFolders(id);
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
      const files = await this.api.listFilesInFolder( fid);
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

      const parentId = parentOf.get(fid) ?? '0';
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
      const children = await this.api.listChildrenFolders( fid);
      for (const c of children) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          queue.push(c.id);
          subfolderCount++;
        }
      }

      // files in this folder
      const files = await this.api.listFilesInFolder( fid);
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
      folderId: this.currentFolderId(), // string
      name: file.name,
      mime: file.type,
      size: file.size,
      url: dataUrl,
      createdAt: now,
      updatedAt: now,
    };
    const created = this.nFile(await this.api.createFile(body));
    const map = new Map(this.filesById());
    map.set(created.id, created);
    this.filesById.set(map);
    this._addFileIndex(created.folderId, created.id);
  }

  async renameFile(id: Id, newName: string) {
    const file = this.filesById().get(id);
    if (!this.perm.canEditFile(file)) {
      this.snackbar.open('You do not have permission to rename this file.', 'Close', {
        duration: 3000,
      });
      throw new Error('No permission to rename file');
    }
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
    if (!this.perm.canEditFile(old)) {
      this.snackbar.open('You do not have permission to move this file.', 'Close', {
        duration: 3000,
      });
      throw new Error('No permission to move file');
    }
    const oldFolder = old?.folderId ?? this.currentFolderId();
    const updated = this.nFile(await this.api.moveFile(id, targetFolderId));
    const map = new Map(this.filesById());
    map.set(updated.id, updated);
    this.filesById.set(map);
    this._removeFileIndex(oldFolder, id);
    this._addFileIndex(targetFolderId, id);
  }

  async deleteFile(id: Id) {
    const file = this.filesById().get(id);
    if (!this.perm.canEditFile(file)) {
      this.snackbar.open('You do not have permission to delete this file.', 'Close', {
        duration: 3000,
      });
      throw new Error('No permission to delete file');
    }

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
      const allowedFileIds = [...this.selectedFileIds()].filter((id) =>
        this.perm.canEditFile(this.filesById().get(id))
      );
      const allowedFolderIds = [...this.selectedFolderIds()].filter((id) =>
        this.perm.canEditFolder(this.foldersById().get(id))
      );

      const skipped = this.selectedCount() - (allowedFileIds.length + allowedFolderIds.length);
      if (skipped > 0) this.error.set(`Some items were skipped due to permissions.`);

      await Promise.all(allowedFileIds.map((id) => this.deleteFile(id)));
      for (const fid of allowedFolderIds) await this.deleteFolderFlow(fid);

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
      await this.ensureFolderPrimed(targetFolderId);

      const sourceFileFolders = new Set<string>();
      for (const id of this.selectedFileIds()) {
        const f = this.filesById().get(id);
        if (f) sourceFileFolders.add(f.folderId);
      }
      const sourceFolderParents = new Set<string>();
      for (const fid of this.selectedFolderIds()) {
        const folder = this.foldersById().get(fid);
        if (folder) sourceFolderParents.add(folder.parentId);
      }

      for (const id of this.selectedFileIds()) {
        await this.moveFile(id, targetFolderId);
      }

      for (const fid of this.selectedFolderIds()) {
        await this.moveFolder(fid, targetFolderId);
      }

      const toRefresh = new Set<Id>([targetFolderId, ...sourceFileFolders, ...sourceFolderParents]);
      for (const fid of toRefresh) {
        await this.refreshFolderFromServer(fid);
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

  private async ensureFolderPrimed(folderId: Id) {
    const hasFilesIdx = this.filesByFolder().has(folderId);
    const hasChildrenIdx = this.childrenByParent().has(folderId);
    if (hasFilesIdx && hasChildrenIdx) return;

    const uid = this.userId();
    const [folders, files] = await Promise.all([
      this.api.listChildrenFolders( folderId),
      this.api.listFilesInFolder( folderId),
    ]);

    const fMap = new Map(this.foldersById());
    folders.forEach((f) => fMap.set(f.id, f));
    this.foldersById.set(fMap);

    const fileMap = new Map(this.filesById());
    files.forEach((f) => fileMap.set(f.id, f));
    this.filesById.set(fileMap);

    const childIdx = new Map(this.childrenByParent());
    childIdx.set(
      folderId,
      folders.map((f) => f.id)
    );
    this.childrenByParent.set(childIdx);

    const filesIdx = new Map(this.filesByFolder());
    filesIdx.set(
      folderId,
      files.map((f) => f.id)
    );
    this.filesByFolder.set(filesIdx);
  }

  private async refreshFolderFromServer(folderId: Id) {
    const uid = this.userId();
    const [folders, files] = await Promise.all([
      this.api.listChildrenFolders( folderId),
      this.api.listFilesInFolder( folderId),
    ]);

    const fMap = new Map(this.foldersById());
    folders.forEach((f) => fMap.set(f.id, f));
    this.foldersById.set(fMap);

    const fileMap = new Map(this.filesById());
    files.forEach((f) => fileMap.set(f.id, f));
    this.filesById.set(fileMap);

    const childIdx = new Map(this.childrenByParent());
    childIdx.set(
      folderId,
      folders.map((f) => f.id)
    );
    this.childrenByParent.set(childIdx);

    const filesIdx = new Map(this.filesByFolder());
    filesIdx.set(
      folderId,
      files.map((f) => f.id)
    );
    this.filesByFolder.set(filesIdx);
  }

  async isInvalidFolderMoveSingle(folderId: string, targetFolderId: string): Promise<boolean> {
    if (String(folderId) === String(targetFolderId)) return true;
    const path = await this.api.getFolderPath(String(targetFolderId));
    return path.some((p) => String(p.id) === String(folderId));
  }

  // zip file helper

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  async addBlobAsFile(name: string, blob: Blob, folderId: Id = this.currentFolderId()) {
    const now = new Date().toISOString();
    const dataUrl = await this.blobToDataUrl(blob);

    const body = {
      userId: this.userId(),
      folderId: String(folderId),
      name,
      mime: blob.type || 'application/octet-stream',
      size: blob.size,
      url: dataUrl,
      createdAt: now,
      updatedAt: now,
    };

    const created = this.nFile(await this.api.createFile(body));
    const map = new Map(this.filesById());
    map.set(created.id, created);
    this.filesById.set(map);
    this._addFileIndex(created.folderId, created.id);
    return created;
  }

  getSelectedFileItems(): FileItem[] {
    const map = this.filesById();
    const out: FileItem[] = [];
    for (const id of this.selectedFileIds()) {
      const f = map.get(String(id));
      if (f) out.push(f);
    }
    return out;
  }

  getSelectedFolderIds(): string[] {
    return [...this.selectedFolderIds()].map(String);
  }

  suggestBatchZipName(): string {
    const count = this.selectedCount();
    if (count === 1) {
      const files = this.getSelectedFileItems();
      if (files.length === 1) return `${files[0].name.replace(/\.[^/.]+$/, '')}.zip`;
      const folders = this.getSelectedFolderIds();
      if (folders.length === 1) {
        const f = this.foldersById().get(folders[0]);
        if (f?.name) return `${f.name}.zip`;
      }
    }
    return `Selection_${new Date().toISOString().slice(0, 10)}.zip`;
  }

  // extract file helper

  async createFolderUnder(name: string, parentId: Id) {
    const body = {
      userId: this.userId(),
      name,
      parentId: String(parentId),
      createdAt: new Date().toISOString(),
    };
    const created = this.nFolder(await this.api.createFolder(body));

    const fMap = new Map(this.foldersById());
    fMap.set(created.id, created);
    this.foldersById.set(fMap);

    const childIdx = new Map(this.childrenByParent());
    const arr = childIdx.get(created.parentId) ?? [];
    childIdx.set(created.parentId, [...arr, created.id]);
    this.childrenByParent.set(childIdx);

    return created;
  }

  async ensureFolderPath(parentId: Id, segments: string[]): Promise<Id> {
    let current = String(parentId);

    for (const rawSeg of segments) {
      const seg = (rawSeg || '').trim();
      if (!seg) continue;

      await this.ensureFolderPrimed(current);

      // find child by name
      const childIds = this.childrenByParent().get(current) ?? [];
      const byId = this.foldersById();
      let child = childIds.map((id) => byId.get(id)!).find((f) => f?.name === seg);

      // create if missing
      if (!child) {
        child = await this.createFolderUnder(seg, current);
      }
      current = child.id;
    }

    return current;
  }

  // unique folder names
  private _uniquifyName(folderId: Id, name: string): string {
    const filesIdx = this.filesByFolder().get(String(folderId)) ?? [];
    const byId = this.filesById();
    const existing = new Set(filesIdx.map((id) => byId.get(id)?.name).filter(Boolean) as string[]);

    if (!existing.has(name)) return name;

    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let n = 1;
    let candidate = `${base} (${n})${ext}`;
    while (existing.has(candidate)) {
      n++;
      candidate = `${base} (${n})${ext}`;
    }
    return candidate;
  }
}
