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
import { TutorialComponent } from './tutorial/tutorial.component';
import { SettingsComponent } from './settings/settings.component';

const routes: Routes = [
  { path: '', component: GameComponent},
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
    TutorialComponent,
    SettingsComponent
  ],
  imports: [
    BrowserModule,
    NgbModule,
    RouterModule.forRoot(routes),
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
