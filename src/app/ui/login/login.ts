import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth-service';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  hide = signal(true);
  errorMessage = signal('');
  auth = inject(AuthService);
  snackbar = inject(MatSnackBar);
  router = inject(Router)

  loading = signal(false);

  readonly form = new FormGroup(
    {
      password: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
    }
  );

  get email() {
    return this.form.get('email')!;
  }

  get password() {
    return this.form.get('password')!;
  }

  constructor() {
    merge(this.email.statusChanges, this.email.valueChanges)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.updateErrorMessage());
  }
  clickEvent(event: MouseEvent) {
    event.preventDefault();
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  updateErrorMessage() {
    if (this.email.hasError('required')) {
      this.errorMessage.set('You must enter a value');
    } else if (this.email.hasError('email')) {
      this.errorMessage.set('Not a valid email');
    } else {
      this.errorMessage.set('');
    }
  }

  async loginUser() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const rawEmail = String(this.form.value.email ?? '').trim().toLowerCase();
    const rawPassword = String(this.form.value.password ?? '');

    this.loading.set(true);
    try {
      const users = await this.auth.getUserByEmail(rawEmail);
      const user = users.find(u => String(u.email || '').trim().toLowerCase() === rawEmail);

      if (!user) {
        this.snackbar.open('Login failed', '', {duration: 1200});
        return;
      }

      if (user.password !== rawPassword) {
        this.snackbar.open('Incorrect password', '', {duration: 1200});
        return;
      }

      this.auth.setUser(user);
      this.snackbar.open('Login successful', '', {duration: 1000});
      await this.router.navigate(['/home']);
    } catch (err) {
      console.error(err);
      this.snackbar.open('Network error. Try again.', '', {duration: 1400});
    } finally {
      this.loading.set(false);
    }
  }
}
