import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-tutorial',
  templateUrl: './tutorial.component.html',
  styleUrls: ['./tutorial.component.scss']
})
export class TutorialComponent {

  @Output() closed = new EventEmitter<void>();
  @Output() faq = new EventEmitter<void>();

  closeEvent(){
    this.closed.emit()
  }

  faqEvent(){
    this.faq.emit()
  }

}