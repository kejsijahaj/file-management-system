import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { User } from "../../shared/models/user-model";

@Injectable({
  providedIn: "root",
})
export class AuthService {

  private apiUrl = "http://localhost:3000/users";

  constructor(private http: HttpClient) {}

  registerUser(userDetails: User) {
    return this.http.post<User>(`${this.apiUrl}`, userDetails);
  }

  getUserByEmail(email: string) {
    return this.http.get<User[]>(`${this.apiUrl}?email=${email}`);
  }
}