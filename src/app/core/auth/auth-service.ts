import { HttpClient } from "@angular/common/http";
import { computed, Injectable, signal } from "@angular/core";
import { User, NewUser, Permission } from "../../shared/models/user-model";
import { firstValueFrom } from "rxjs";
import { MatSnackBar } from "@angular/material/snack-bar";

@Injectable({
  providedIn: "root",
})
export class AuthService {

  private apiUrl = "http://localhost:3000/users";
  private readonly STORAGE_KEY = "user";

  private _user = signal<User | null>(this.readFromStorage());
  user = computed(() => this._user());

  displayName = computed<string>(() => {
    const u = this._user();
    return u?.username as string;
  });

  constructor(private http: HttpClient, private snackbar: MatSnackBar) {}

  // session helpers
  setUser(user: User | null) {
    this._user.set(user);
    if (user) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.STORAGE_KEY);
    } 
  }

  getCurrentUser (): User | null {
    return this._user();
  }

  getUsername(): string {
    return this.displayName();
  }

  isLoggedIn(): boolean {
    return this._user() !== null;
  }

  logout(): void {
    this.setUser(null);
  }

  // async api

  async registerUser(userDetails: NewUser): Promise<User> {
    return await firstValueFrom(this.http.post<User>(`${this.apiUrl}`, userDetails));
  }

  async getUserByEmail(email: string): Promise<User[]> {
    return await firstValueFrom(this.http.get<User[]>(`${this.apiUrl}?email=${encodeURIComponent(email)}`));
  }

  async getUserByUsername(username: string): Promise<User[]> {
    return await firstValueFrom(this.http.get<User[]>(`${this.apiUrl}?username=${encodeURIComponent(username)}`));
  }

  async isEmailTaken(email: string, excludeId?: string | number): Promise<boolean> {
    const list = await this.getUserByEmail(email);
    return list.some(u => String(u.id) !== String(excludeId));
  }

  async isUsernameTaken(username: string, excludeId?: string | number): Promise<boolean> {
    const list = await this.getUserByUsername(username);
    return list.some(u => String(u.id) !== String(excludeId));
  }

  async updateUser(user: User): Promise<User> {
    const saved = await firstValueFrom(this.http.put<User>(`${this.apiUrl}/${user.id}`, user));
    return saved;
  }

  async updateProfile(partial: Partial<User>): Promise<User> {
    const cur = this._user();
    if (!cur) {
      this.snackbar.open('No current user', 'Close', { duration: 3000 });
      throw new Error('No current user');
    }
    const next: User = {...cur, ...partial, id: cur.id};
    const saved = await this.updateUser(next);
    this.setUser(saved);
    return saved;
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<User> {
    const cur = this._user();
      if (!cur) {
        this.snackbar.open('No current user', 'Close', { duration: 3000 });
        throw new Error('No current user');
      }
    if (cur.password !== currentPassword) {
      this.snackbar.open('Current password is incorrect', 'Close', { duration: 3000 });
      throw new Error('Current password is incorrect');
    }
    const saved = await this.updateUser({...cur, password: newPassword});
    this.setUser(saved);
    return saved;
  }

  // storage

  private readFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if(!raw) return null;
      const u = JSON.parse(raw) as Partial<User>;
      if (u && !('role' in u)) (u as any).role = 'user';
      return u as User;
    } catch {
      return null;
    }
  }

  // admin: user list & management
  async listAllUsers(): Promise<User[]> {
    return await firstValueFrom(this.http.get<User[]>(this.apiUrl));
  }

  async deleteUser(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${this.apiUrl}/${id}`));
  }

  // admin: permissions
  async setUserPermissions(id: string, permissions: Permission[]): Promise<User> {
    return await firstValueFrom(this.http.patch<User>(`${this.apiUrl}/${id}`, {permissions}));
  }

  async toggleUserPermission(id: string, perm: Permission): Promise<User> {
    const user = await firstValueFrom(this.http.get<User>(`${this.apiUrl}/${id}`));
    const current = new Set(user.permissions ?? []);
    if (current.has(perm)) current.delete(perm);
    else current.add(perm);
    return await this.setUserPermissions(id, [...current]);
  }

  // util
  hasPermission(user: User | null, perm: Permission): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return (user.permissions ?? []).includes(perm);
  }
}