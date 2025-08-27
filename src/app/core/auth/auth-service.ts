import { HttpClient } from "@angular/common/http";
import { computed, Injectable, signal } from "@angular/core";
import { User } from "../../shared/models/user-model";

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

  constructor(private http: HttpClient) {}

  registerUser(userDetails: User) {
    return this.http.post<User>(`${this.apiUrl}`, userDetails);
  }

  getUserByEmail(email: string) {
    return this.http.get<User[]>(`${this.apiUrl}?email=${email}`);
  }

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

  private readFromStorage(): User | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}