import { Component } from '@angular/core';
import { Header } from '../header/header';
import { Sidenav} from '../sidenav/sidenav';
import { Content } from '../content/content';
import { MatDrawerContainer } from "@angular/material/sidenav";
import {MatSidenavModule} from '@angular/material/sidenav';

@Component({
  selector: 'app-home',
  imports: [Sidenav, Content, Header, MatDrawerContainer, MatSidenavModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {

}
