import { Component, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'keyboard',
  templateUrl: './keyboard.component.html',
  styleUrls: ['./keyboard.component.scss']
})
export class KeyboardComponent implements OnInit {

  @Output() keypressEvent = new EventEmitter<string>();

  lettersRow1 = ["Q","W","E","R","T","Y","U","I","O","P"]
  lettersRow2 = ["A","S","D","F","G","H","J","K","L"]
  lettersRow3 = ["CHECK","Z","X","C","V","B","N","M"]

  constructor() { }

  ngOnInit(): void {
  }

  onKeypress(letter: any){
    this.keypressEvent.emit(letter)
  }

}
