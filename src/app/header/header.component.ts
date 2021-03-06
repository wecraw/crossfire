import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {

  @Input() practiceMode: boolean = false;
  @Input() disabled: boolean = false;

  @Output() helpClickEvent = new EventEmitter<any>();
  @Output() settingsClickEvent = new EventEmitter<any>();
  @Output() menuClickEvent = new EventEmitter<string>();

  constructor() { }

  ngOnInit(): void {
  }

  onHelpClick(){
    this.helpClickEvent.emit()
  }

  onSettingsClick(){
    this.settingsClickEvent.emit()
  }

  onMenuPress(menuItem: string){
    this.menuClickEvent.emit(menuItem)
  }

}
