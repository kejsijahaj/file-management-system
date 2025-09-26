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
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';

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
    MatTab,
    MatTabGroup,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
})
export class AdminSettings {
  private auth = inject(AuthService);
  private snackbar = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  dialogRef = inject(MatDialogRef<AdminSettings>);

  users = signal<User[]>([]);
  allPerms = ALL_PERMS;
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<string | null>(null);
  showPw = signal(false);
  showNewPw = signal(false);
  showConfirmPw = signal(false);

  profileForm = this.fb.group({
    username: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9]+$'), Validators.minLength(3), Validators.maxLength(30)]],
    email: ['', [Validators.required, Validators.email]],
  });

  passwordForm = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  }, {validators: this.passwordsMatch });

  ngOnInit() {
    const me = this.auth.getCurrentUser();
    if (me) this.profileForm.patchValue({username: me.username, email: me.email});
  }

  // validators
  private passwordsMatch(group: AbstractControl): ValidationErrors | null {
    const a = group.get('newPassword')?.value;
    const b = group.get('confirmPassword')?.value;
    return a && b && a !== b ? {mismatch: true} : null;
  }

  // form actions
  async saveProfile() {
    if(this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const me = this.auth.getCurrentUser();
    if (!me) return;

    const { username, email } = this.profileForm.value as {username: string; email: string;};
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      if (username !== me.username && await this.auth.isUsernameTaken(username,me.id)) {
        this.snackbar.open('Username is already taken', 'Close', { duration: 3000 });
        throw new Error('Username is already taken');
      }
      if (email !== me.email && await this.auth.isEmailTaken(email, me.id)) {
        this.snackbar.open('Email is already taken', 'Close', { duration: 3000 });
        throw new Error('Email is already taken');
      }

      await this.auth.updateProfile({username, email});
      this.snackbar.open('Profile updated', '', { duration: 1000 });
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to update profile');
      this.snackbar.open(this.error()!, 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

  async savePassword() {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const {currentPassword, newPassword} = this.passwordForm.value as any;
    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    try {
      await this.auth.changePassword(currentPassword, newPassword);
      this.passwordForm.reset();
      this.success.set('Password updated');
      this.snackbar.open('Password updated', '', { duration: 1000 });
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to change password');
      this.snackbar.open(this.error()!, 'Close', { duration: 3000 });
    } finally {
      this.loading.set(false);
    }
  }

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
