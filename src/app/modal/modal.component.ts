import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss']
})
export class ModalComponent implements OnInit {

  @Input() decisionModal: boolean = false;
  @Input() headerText: string;
  @Input() bodyText: string;
  @Input() primaryLabel: string = 'Confirm';
  @Input() secondaryLabel: string = 'Cancel';
  @Input() timeRemaining: boolean = false;
  
  @Output() secondaryEvent = new EventEmitter<any>();
  @Output() primaryEvent = new EventEmitter<any>();

  secondsUntilTomorrow: string;
  interval: any;

  constructor() { }

  ngOnInit(): void {
    if (this.timeRemaining){
      this.secondsUntilTomorrow = this.getSecondsUntilTomorrow();
      this.interval = setInterval(() => {
        this.secondsUntilTomorrow = this.getSecondsUntilTomorrow(); 
      }, 1000);
    }
  }

  onSecondaryClick(){
    this.secondaryEvent.emit()
  }

  onPrimaryClick(){
    this.primaryEvent.emit()
  }

  getSecondsUntilTomorrow() {
    let now: any = new Date();
    const SECONDS = 86400 - Math.floor(now / 1000) % 86400 + 25200;

    return new Date(SECONDS * 1000).toISOString().substring(11, 19)
  }

}
