import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'level',
  templateUrl: './level.component.html',
  styleUrls: ['./level.component.scss']
})
export class LevelComponent implements OnInit {
  
  @Input() state: string = "upcoming"
  @Input() day: string = ""
  src: any;
  
  constructor() { }

  ngOnInit(): void {
    if (this.state === "upcoming") this.src = '../../assets/images/in_progress.png'
    if (this.state === "current") this.src = '../../assets/images/in_progress.png'
    if (this.state === "complete") this.src = '../../assets/images/completed_level.png'


  }

}
