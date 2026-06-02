import { Component, Input } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-progress-bar',
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss']
})
export class ProgressComponent {

  @Input() currentLevel: number = 0;

  levels = [
    "Mo",
    "Tu",
    "We",
    "Th",
    "Fr",
    "Sa",
    "Su"
  ]

}
