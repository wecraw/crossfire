import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'keyboard-button',
  templateUrl: './keyboard-button.component.html',
  styleUrls: ['./keyboard-button.component.scss']
})
export class KeyboardButtonComponent implements OnInit {

  @Input() label: string;
  @Input() state: "default" | "present" | "correct" | "absent" = "default"

  constructor() { }

  ngOnInit(): void {
  }

}
