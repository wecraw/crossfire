import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'square',
  templateUrl: './square.component.html',
  styleUrls: ['./square.component.scss']
})
export class SquareComponent implements OnInit {

  @Input() state: string = "default";
  @Input() letter: string = "";
  @Input() clueNumber: string = "";
  @Input() highlighted: boolean = false;
  @Input() letterSize: number = 0
  @Input() header: boolean = false;
  @Input() checked: boolean = false;
  
  constructor() { }

  ngOnInit(): void {
  }
  getLetterSizeClass(){
    if (this.letterSize < 7) return ""
    return "letters-" + this.letterSize
  }


}
