import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-keyboard-button',
  templateUrl: './keyboard-button.component.html',
  styleUrls: ['./keyboard-button.component.scss']
})
export class KeyboardButtonComponent {

  @Input() label: string;
  @Input() state: "default" | "present" | "correct" | "absent" = "default"

}
