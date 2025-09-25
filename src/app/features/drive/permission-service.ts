import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth-service';
import { FileItem } from '../../shared/models/file-model';
import { Folder } from '../../shared/models/folder-model';
import { Permission } from '../../shared/models/user-model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
    private auth = inject(AuthService);

    isAdmin(): boolean {
        const u = this.auth.getCurrentUser();
        return !!u && u.role === 'admin';
    }

    private has(perm: Permission): boolean {
        const u = this.auth.getCurrentUser();
        if (!u) return false;
        if (u.role === 'admin') return true;
        return (u.permissions ?? []).includes(perm);
    }

    canUpload(): boolean {
        return this.has('upload');
    }

    canRenameFile(file?: FileItem): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !file) return false;
        if (u.role === 'admin') return true;
        return this.has('rename') && String(file.userId) === String(u.id);
    }

    canMoveFile(file?: FileItem): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !file) return false;
        if (u.role === 'admin') return true;
        return this.has('move') && String(file.userId) === String(u.id);
    }
    
    canReadFile(file?: FileItem): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !file) return false;
        if (u.role === 'admin') return true;
        return this.has('read') && String(file.userId) === String(u.id);
    }

    canDeleteFile(file?: FileItem): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !file) return false;
        if (u.role === 'admin') return true;
        return this.has('delete') && String(file.userId) === String(u.id);
    }

    canRenameFolder(folder?: Folder): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !folder) return false;
        if (u.role === 'admin') return true;
        return this.has('rename') && String(folder.userId) === String(u.id);
    }

    canMoveFolder(folder?: Folder): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !folder) return false;
        if (u.role === 'admin') return true;
        return this.has('move') && String(folder.userId) === String(u.id);
    }

    canDeleteFolder(folder?: Folder): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !folder) return false;
        if (u.role === 'admin') return true;
        return this.has('delete') && String(folder.userId) === String(u.id);
    }
}
