import { Routes } from '@angular/router';
import { Content } from './ui/content/content';
import { Login } from './ui/login/login';
import { Register } from './ui/register/register';

export const routes: Routes = [
    {path: '', pathMatch: 'full', redirectTo: 'login'},
    // { path: 'drive/folder/:id', component: Content},
    // { path: '**', redirectTo: 'drive/folder/0'}, // no data found component
    { path: 'login', component: Login },
    { path: 'register', component: Register }
];
