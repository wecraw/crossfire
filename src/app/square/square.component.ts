import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-square',
  templateUrl: './square.component.html',
  styleUrls: ['./square.component.scss']
})
export class SquareComponent {

  @Input() state: string = "default";
  @Input() letter: string = "";
  @Input() clueNumber: string = "";
  @Input() highlighted: boolean = false;
  @Input() locked: boolean = false;
  @Input() letterSize: number = 0
  @Input() header: boolean = false;
  @Input() checked: boolean = false;

  getLetterSizeClass(){
    if (this.letterSize < 7) return ""
    return "letters-" + this.letterSize
  }


}
