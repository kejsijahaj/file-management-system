import { Component, inject, signal } from '@angular/core';
import { FormBuilder, Validators, AbstractControl, ValidationErrors, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth-service';
import { single } from 'rxjs';

@Component({
  selector: 'app-dashboard',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<Dashboard>);
  private auth = inject(AuthService);
  private snackbar = inject(MatSnackBar);

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

  // actions
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

  close() {this.dialogRef.close();}
}
