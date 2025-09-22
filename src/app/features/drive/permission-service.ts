import { Injectable, inject } from '@angular/core';
import { AuthService } from '../../core/auth/auth-service';
import { FileItem } from '../../shared/models/file-model';
import { Folder } from '../../shared/models/folder-model';

@Injectable({ providedIn: 'root' })
export class PermissionService {
    private auth = inject(AuthService);

    isAdmin(): boolean {
        const u = this.auth.getCurrentUser();
        return !!u && u.role === 'admin';
    }

    canEditFile(file: FileItem | undefined): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !file) return false;
        if (u.role === 'admin') return true;
        return String(file.userId) === String(u.id);
    }

    canEditFolder(folder: Folder | undefined): boolean {
        const u = this.auth.getCurrentUser();
        if (!u || !folder) return false;
        if (u.role === 'admin') return true;
        return String(folder.userId) === String(u.id);
    }
}
