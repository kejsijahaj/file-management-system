import { Routes } from '@angular/router';
import { Login } from './ui/login/login';
import { Register } from './ui/register/register';
import { Home } from './ui/home/home';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'drive/folder/:id', component: Home },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'home', component: Home },
  { path: '**', redirectTo: 'login', pathMatch: 'full' },
];
