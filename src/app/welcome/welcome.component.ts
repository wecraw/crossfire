import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-welcome',
  templateUrl: './welcome.component.html',
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent {

  @Output() closed = new EventEmitter<void>();
  @Output() howToPlay = new EventEmitter<void>();

  closeEvent(){
    this.closed.emit()
  }

  howToPlayEvent(){
    this.howToPlay.emit()
  }

}
