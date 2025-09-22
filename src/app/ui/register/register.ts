import { Component, signal, inject} from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButton } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { merge } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth-service';
import { User, NewUser } from '../../shared/models/user-model';

@Component({
  selector: 'app-register',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatButton,
    MatSelectModule,
    MatIconModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register {
  protected readonly value = signal('');
  errorMessage = signal('');
  hide = signal(true);
  loading = signal(false);

  auth = inject(AuthService);
  snackbar = inject(MatSnackBar);
  router = inject(Router);

  readonly form = new FormGroup(
    {
      username: new FormControl('', [Validators.required, Validators.pattern('^[a-zA-Z0-9]+$'), Validators.minLength(3), Validators.maxLength(30)]),
      password: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
    },
  );

  get username() {
    return this.form.get('username')!;
  }

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
  protected onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
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
  clickEvent(event: MouseEvent) {
    event.preventDefault();
    this.hide.set(!this.hide());
    event.stopPropagation();
  }

  async submit() {
    if (this.form.invalid || this.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const username = String(this.username.value ?? '').trim();
    const email = String(this.email.value ?? '').trim().toLowerCase();
    const password = String(this.password.value ?? '');

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      if(await this.auth.isUsernameTaken(username)) {
        this.snackbar.open('Username is already taken', '', {duration: 1200});
        return;
      }
      if (await this.auth.isEmailTaken(email)) {
        this.snackbar.open('Email is already taken', '', {duration: 1200});
        return;
      }

      const payload = {username, email, password, role: 'user'} as const;
      await this.auth.registerUser(payload);
      this.snackbar.open('User registered successfully', '', {duration: 1200});
      await this.router.navigate(['/login']);
    } catch (err: any) {
      console.error(err);
      this.errorMessage.set(err?.message ?? 'Error registering user');
      this.snackbar.open('Error registering user', '', {duration: 1200});
    } finally {
      this.loading.set(false);
    }
  }
}
