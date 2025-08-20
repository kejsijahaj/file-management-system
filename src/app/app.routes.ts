import { Routes } from '@angular/router';
import { Content } from './ui/content/content';

export const routes: Routes = [
    {path: '', pathMatch: 'full', redirectTo: 'drive/folder/0'},
    { path: 'drive/folder/:id', component: Content},
    { path: '**', redirectTo: 'drive/folder/0'}
];
