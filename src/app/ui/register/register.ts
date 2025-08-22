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
// import { passwordMatchValidator } from '../../shared/services/password-match';
import { AuthService } from '../../core/auth/auth-service';
import { User } from '../../shared/models/user-model';

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
  auth = inject(AuthService);
  snackBar = inject(MatSnackBar);
  router = inject(Router);

  readonly form = new FormGroup(
    {
      username: new FormControl('', [Validators.required, Validators.pattern('^[a-zA-Z0-9]+$')]),
      password: new FormControl('', [Validators.required]),
      // confirmPassword: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.required, Validators.email]),
    },
    // {
    //   validators: passwordMatchValidator()
    // }
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

  // get confirmPassword() {
  //   return this.form.get('confirmPassword')!;
  // }

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

  submit() {
    if (this.form.valid) {
      const postData = { ...this.form.value};
      this.auth.registerUser(postData as User).subscribe(
        response => {
          console.log('User registered successfully', response);
          this.snackBar.open('User registered successfully', '', {
            duration: 1000,
          });
          this.router.navigate(['/login']);
        },
        error => {
          console.error('Error registering user', error);
          this.snackBar.open('Error registering user', '', {
            duration: 1000,
          });
        }
      )
    } else {
      this.form.markAllAsTouched();
    }
  }
}
