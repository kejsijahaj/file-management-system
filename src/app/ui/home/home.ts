import { Component } from '@angular/core';
import { Header } from '../header/header';
import { Sidenav} from '../sidenav/sidenav';
import { Content } from '../content/content';

@Component({
  selector: 'app-home',
  imports: [Sidenav, Content, Header],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home {

}
