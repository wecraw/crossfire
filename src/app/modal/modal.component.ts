import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import * as moment from 'moment-timezone';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent implements OnInit {

  @Input() decisionModal: boolean = false;
  @Input() primaryLabel: string = 'Confirm';
  @Input() secondaryLabel: string = 'Cancel';
  @Input() incorrectGuessesByLevel: number[];
  @Input() stats: any;
  @Input() currentLevel: number;
  
  @Output() secondaryEvent = new EventEmitter<any>();
  @Output() primaryEvent = new EventEmitter<any>();

  secondsUntilTomorrow: string;
  interval: any;
  newDay: boolean = false;

  levels = [
    "Mo",
    "Tu",
    "We",
    "Th",
    "Fr",
    "Sa",
    "Su"
  ]

  constructor() { }

  ngOnInit(): void {
    this.secondsUntilTomorrow = this.getTimeUntilMidnightPST();
    this.interval = setInterval(() => {
      this.secondsUntilTomorrow = this.getTimeUntilMidnightPST(); 
    }, 1000);
  }

  refresh(){
    window.location.reload()
  }

  onSecondaryClick(){
    this.secondaryEvent.emit()
  }

  onPrimaryClick(){
    this.primaryEvent.emit()
  }

  numSequence(n: number): Array<number> {
    return Array(n);
  }

  getTimeUntilMidnightPST(): string {
    let now: any = new Date();
    const SECONDS = 86400 - Math.floor(now / 1000) % 86400 + 25200;
    if (SECONDS === 86400) this.newDay = true;
    
    //convert to hh:mm:ss
    return new Date(SECONDS * 1000).toISOString().substring(11, 19)
  }

}
