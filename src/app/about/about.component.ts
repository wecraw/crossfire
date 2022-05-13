import { Component, EventEmitter, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  @Output() onClose = new EventEmitter<any>();
  @Output() onToggleHelp = new EventEmitter<any>();

  constructor() { }

  closeEvent(){
    this.onClose.emit()
  }

  toggleHelpEvent(){
    this.onToggleHelp.emit()
  }

  ngOnInit(): void {
  }

}
