import { Component, OnInit, Output, EventEmitter, Input } from '@angular/core';

@Component({
  selector: 'app-keyboard',
  templateUrl: './keyboard.component.html',
  styleUrls: ['./keyboard.component.scss'],
})
export class KeyboardComponent {
  @Input() presentLetters: string[] = [];
  @Input() correctLetters: string[] = [];
  @Input() absentLetters: string[] = [];

  @Output() keypressEvent = new EventEmitter<string>();

  lettersRow1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
  lettersRow2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
  lettersRow3 = ['CHECK', 'Z', 'X', 'C', 'V', 'B', 'N', 'M'];

  constructor() {}

  getState(letter: string) {
    if (this.correctLetters.includes(letter)) {
      return 'correct';
    } else if (this.presentLetters.includes(letter)) {
      return 'present';
    } else if (this.absentLetters.includes(letter)) {
      return 'absent';
    } else {
      return 'default';
    }
  }

  onKeypress(letter: any) {
    this.keypressEvent.emit(letter);
  }
}
