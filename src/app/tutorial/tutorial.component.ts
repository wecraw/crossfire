import { Component, OnInit, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-tutorial',
  templateUrl: './tutorial.component.html',
  styleUrls: ['./tutorial.component.scss']
})
export class TutorialComponent implements OnInit {

  @Output() onClose = new EventEmitter<any>();
  @Output() onFaq = new EventEmitter<any>();

  constructor() { }

  closeEvent(){
    this.onClose.emit()
  }

  faqEvent(){
    this.onFaq.emit()
  }

  ngOnInit(): void {
  }

}