import { Component } from '@angular/core';


export interface IClue {
  clueNumber: number;
  clue: any;
  answer: any;
}

export interface ILetter {
  letter: any;
  state: "default" | "correct" | "incorrect"
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

}
