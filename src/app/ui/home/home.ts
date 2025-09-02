import { Component } from '@angular/core';
import { Header } from '../header/header';
import { Sidenav} from '../sidenav/sidenav';
import { Content } from '../content/content';
import {MatSidenavModule} from '@angular/material/sidenav';
import { Toolbar } from "../toolbar/toolbar";

@Component({
  selector: 'app-home',
  imports: [Sidenav, Content, Header, MatSidenavModule, Toolbar],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {

}
