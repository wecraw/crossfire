import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent {

  @Output() closed = new EventEmitter<void>();
  @Output() toggleHelp = new EventEmitter<void>();

  closeEvent(){
    this.closed.emit()
  }

  toggleHelpEvent(){
    this.toggleHelp.emit()
  }

}
