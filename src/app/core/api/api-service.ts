import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { User } from '../../shared/models/user-model';
import { Folder } from '../../shared/models/folder-model';
import { FileItem } from '../../shared/models/file-model';

type Order = 'asc' | 'desc'; 

function paramsForm(obj: Record<string, any>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = '/api'; // as per proxy

  // -------- helpers --------

  private get<T>(path: string, params?: HttpParams): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base}${path}`, { params }));
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.base}${path}`, body));
  }

  private put<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(`${this.base}${path}`, body));
  }

  private patch<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`${this.base}${path}`, body));
  }

  private delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.base}${path}`));
  }

  // -------- users ---------
  listUsers(): Promise<User[]> {
    return this.get<User[]>(`/users`);
  }

  getUser(id: number): Promise<User> {
    return this.get<User>(`/users/${id}`);
  }

  createUser(body: Omit<User, 'id'>): Promise<User> {
    return this.post<User>(`/users`, body);
  }

  updateUser(id: number, body: User): Promise<User> {
    return this.put<User>(`/users/${id}`, body);
  }

  patchUser(id: number, partial: Partial<User>): Promise<User> {
    return this.patch<User>(`/users/${id}`, partial);
  }

  deleteUser(id: number): Promise<void> {
    return this.delete<void>(`/users/${id}`);
  }

  // --------- folders -----------
  listFoldersByUser(userId: number): Promise<Folder[]> {
    const params = paramsForm({ userId, _sort: 'name', _order: 'asc' });
    return this.get<Folder[]>(`/folders`, params);
  }

  listChildrenFolders(
    userId: number,
    parentId: number,
    sort: keyof Folder = 'name',
    order: Order = 'asc'
  ): Promise<Folder[]> {
    const params = paramsForm({
      userId,
      parentId,
      _sort: sort,
      _order: order,
    });
    return this.get<Folder[]>(`/folders`, params);
  }

  getFolder(id: number): Promise<Folder> {
    return this.get<Folder>(`/folders/${id}`);
  }

  createFolder(body: Omit<Folder, 'id'>): Promise<Folder> {
    return this.post<Folder>(`/folders`, body);
  }

  renameFolder(id: number, name: string): Promise<Folder> {
    return this.patch<Folder>(`/folders/${id}`, { name });
  }

  moveFolder(id: number, parentId: number): Promise<Folder> {
    return this.patch<Folder>(`/folders/${id}`, { parentId });
  }

  deleteFolder(id: number): Promise<void> {
    return this.delete<void>(`/folders/${id}`);
    // json server does not cascade delete
  }

  async getFolderPath(folderId: number): Promise<Folder[]> {
    // walk parents to root
    const path: Folder[] = [];
    let cursorId: number | 0 = folderId;
    while (cursorId && cursorId !== 0) {
      const f = await this.getFolder(cursorId);
      path.unshift(f);
      cursorId = f.parentId;
    }
    return path;
  }

  // ------- files ----------
  listFilesInFolder(
    userId: number,
    folderId: number,
    opts?: {
      q?: string;
      sort?: keyof FileItem;
      order?: Order;
      page?: number;
      limit?: number;
    }
  ): Promise<FileItem[]> {
    const params = paramsForm({
      userId,
      folderId,
      name_like: opts?.q,
      _sort: opts?.sort ?? 'name',
      _order: opts?.order ?? 'asc',
      _page: opts?.page,
      _limit: opts?.limit,
    });
    return this.get<FileItem[]>(`/files`, params);
  }

  getFile(id: number): Promise<FileItem> {
    return this.get<FileItem>(`/files/${id}`);
  }

  createFile(body: Omit<FileItem, 'id'>): Promise<FileItem> {
    return this.post<FileItem>(`/files`, body);
  }

  updateFile(id: number, body: FileItem): Promise<FileItem> {
    return this.put<FileItem>(`/files/${id}`, body);
  }

  patchFile(id: number, partial: Partial<FileItem>): Promise<FileItem> {
    return this.patch<FileItem>(`/files/${id}`, partial);
  }

  deleteFile(id: number): Promise<void> {
    return this.delete<void>(`/files/${id}`);
  }

  moveFile(id: number, folderId: number): Promise<FileItem> {
    return this.patchFile(id, { folderId });
  }

  // -------- search ----------
  searchFoldersByName(userId: number, q: string) {
    const params = paramsForm({ userId, name_like: q });
    return this.get<Folder[]>(`/folders`, params);
  }

  searchFilesByName(userId: number, q: string) {
    const params = paramsForm({ userId, name_like: q });
    return this.get<FileItem[]>(`/files`, params);
  }
}