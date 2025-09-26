import { Component, inject, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../core/auth/auth-service';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Dashboard } from '../dashboard/dashboard';
import { AdminSettings } from '../admin-settings/admin-settings';

@Component({
  selector: 'app-header',
  imports: [MatIconModule, MatButtonModule, MatMenuModule],
  templateUrl: './header.html',
  styleUrl: './header.scss'
})
export class Header {
  private auth = inject(AuthService);
  private router = inject(Router);
  private dialog = inject(MatDialog);
  displayName = this.auth.displayName;

  isAdmin = computed(() => this.auth.getCurrentUser()?.role === 'admin');
  isUser = computed(() => this.auth.getCurrentUser()?.role === 'user');

  logOut() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  userDashboard() {
    this.dialog.open(Dashboard, {
      width: '1000px',
      maxWidth: '1500px',
      height: '600px',
      disableClose: false,
    })
  }

  adminSettings() {
    this.dialog.open(AdminSettings, {
      width: '1000px',
      maxWidth: '1500px',
      height: '600px',
      disableClose: false,
      panelClass: 'admin-settings-dialog'
    })
  }

}
