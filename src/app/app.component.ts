import { Component } from '@angular/core';


export interface IClue {
  clueNumber: number;
  clue: string;
  answer: string;
}

export interface ILetter {
  letter: string;
  state: "default" | "correct" | "incorrect"
}

@Component({
  standalone: false,
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent {

}
