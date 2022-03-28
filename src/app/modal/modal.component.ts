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
  
  @Output() secondaryEvent = new EventEmitter<any>();
  @Output() primaryEvent = new EventEmitter<any>();

  constructor() { }

  ngOnInit(): void {
  }

  onSecondaryClick(){
    this.secondaryEvent.emit()
  }

  onPrimaryClick(){
    this.primaryEvent.emit()
  }


}
