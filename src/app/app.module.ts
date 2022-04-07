import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { SquareComponent } from './square/square.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { ProgressComponent } from './progress/progress.component';
import { KeyboardButtonComponent } from './keyboard-button/keyboard-button.component';
import { KeyboardComponent } from './keyboard/keyboard.component';
import { HeaderComponent } from './header/header.component';
import { ModalComponent } from './modal/modal.component';
import { RouterModule, Routes } from '@angular/router';
import { GameComponent } from './game/game.component';
import { SearchComponent } from './search/search.component';
import { NgAisModule } from 'angular-instantsearch';

const routes: Routes = [
  { path: '', component: GameComponent},
  { path: 'search', component: SearchComponent}
]

@NgModule({
  declarations: [
    AppComponent,
    SquareComponent,
    ProgressComponent,
    KeyboardComponent,
    KeyboardButtonComponent,
    HeaderComponent,
    ModalComponent,
    GameComponent,
    SearchComponent
  ],
  imports: [
    BrowserModule,
    NgbModule,
    RouterModule.forRoot(routes),
    NgAisModule.forRoot()
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
