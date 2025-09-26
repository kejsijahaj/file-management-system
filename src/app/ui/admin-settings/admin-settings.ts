import { Component, inject, signal } from '@angular/core';
import { Permission, User } from '../../shared/models/user-model';
import { AuthService } from '../../core/auth/auth-service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatButtonModule } from '@angular/material/button';

const ALL_PERMS: Permission[] = ['upload', 'rename', 'move', 'read', 'delete', 'add_folder'];

@Component({
  selector: 'app-admin-settings',
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatProgressBarModule,
  ],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettings {
  private auth = inject(AuthService);
  private snackbar = inject(MatSnackBar);
  dialogRef = inject(MatDialogRef<AdminSettings>);

  users = signal<User[]>([]);
  allPerms = ALL_PERMS;
  loading = signal(false);

  constructor() {
    this.refresh();
  }

  async refresh() {
    try {
      this.loading.set(true);
      this.users.set(await this.auth.listAllUsers());
    } finally {
      this.loading.set(false);
    }
  }

  has(u: User, p: Permission) {
    return (u.permissions ?? []).includes(p);
  }

  async toggle(u: User, p: Permission, checked: boolean) {
    try {
      const current = new Set(u.permissions ?? []);
      checked ? current.add(p) : current.delete(p);
      const updated = await this.auth.setUserPermissions(u.id, [...current]);
      this.users.update((arr) => arr.map((x) => (x.id === u.id ? updated : x)));
      this.snackbar.open(`Updated permissions for ${u.username}`, 'Close', { duration: 3000 });
    } catch (e) {
      console.error(e);
      this.snackbar.open('Failed to update permissions', 'Close', { duration: 3000 });
    }
  }

  async remove(u: User) {
    try {
      await this.auth.deleteUser(u.id);
      this.users.update((arr) => arr.filter((x) => x.id !== u.id));
      this.snackbar.open('User deleted successfully', '', { duration: 900 });
    } catch (e) {
      console.error(e);
      this.snackbar.open('Failed to delete user', '', { duration: 1200 });
    }
  }

  close() { this.dialogRef.close(); }

  initials(name: string) {
    const parts = ( name ?? '').trim().split(/\s+/);
    return (parts[0]?.[0] ?? '').toUpperCase() + (parts[1]?.[0] ?? '')?.toUpperCase();
  }
}
