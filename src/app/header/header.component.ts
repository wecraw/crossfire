import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  @Input() practiceMode: boolean = false;
  @Input() disabled: boolean = false;

  @Output() helpClickEvent = new EventEmitter<any>();
  @Output() settingsClickEvent = new EventEmitter<any>();
  @Output() menuClickEvent = new EventEmitter<string>();

  constructor() {}

  onHelpClick() {
    this.helpClickEvent.emit();
  }

  onSettingsClick() {
    this.settingsClickEvent.emit();
  }

  onMenuPress(menuItem: string) {
    this.menuClickEvent.emit(menuItem);
  }

  onDonatePress() {
    window.open(
      'https://www.paypal.com/donate/?hosted_button_id=ULHKXEU29A2VC',
      '_blank'
    );
  }
}
