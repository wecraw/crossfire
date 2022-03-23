import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { SquareComponent } from './square/square.component';
import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { LevelComponent } from './level/level.component';

@NgModule({
  declarations: [
    AppComponent,
    SquareComponent,
    LevelComponent
  ],
  imports: [
    BrowserModule,
    NgbModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
