import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from "./ui/header/header";
import { Sidenav } from "./ui/sidenav/sidenav";
import { Content } from "./ui/content/content";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Sidenav, Content],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('file-management-system');
}
