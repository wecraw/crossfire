import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import * as moment from 'moment-timezone';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})
export class ModalComponent implements OnInit {
  @Input() decisionModal: boolean = false;
  @Input() primaryLabel: string = 'Confirm';
  @Input() secondaryLabel: string = 'Cancel';
  @Input() incorrectGuessesByLevel: number[];
  @Input() stats: any;
  @Input() currentLevel: number;

  @Output() secondaryEvent = new EventEmitter<any>();
  @Output() primaryEvent = new EventEmitter<any>();

  secondsUntilTomorrow: string;
  interval: any;
  newDay: boolean = false;

  levels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  constructor() {}

  ngOnInit(): void {
    this.secondsUntilTomorrow = this.getSecondsUntilTomorrow();
    this.interval = setInterval(() => {
      this.secondsUntilTomorrow = this.getSecondsUntilTomorrow();
    }, 1000);
    this.testCountdownToPST();
  }

  refresh() {
    window.location.reload();
  }

  onSecondaryClick() {
    this.secondaryEvent.emit();
  }

  onPrimaryClick() {
    this.primaryEvent.emit();
  }

  numSequence(n: number): Array<number> {
    return Array(n);
  }
  getSecondsUntilTomorrow(testDate?: Date): string {
    const pstNow = testDate ? moment(testDate) : moment();
    pstNow.tz('America/Los_Angeles');

    const pstMidnight = pstNow.clone().add(1, 'day').startOf('day');

    const diffSeconds = pstMidnight.diff(pstNow, 'seconds');

    if (diffSeconds === 86400) this.newDay = true;

    const hours = Math.floor(diffSeconds / 3600);
    const minutes = Math.floor((diffSeconds % 3600) / 60);
    const seconds = diffSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  testCountdownToPST(): void {
    const now = moment();
    const testCases = [
      { name: 'PST', timezone: 'America/Los_Angeles' },
      { name: 'EST', timezone: 'America/New_York' },
      { name: 'UTC', timezone: 'UTC' },
      { name: 'IST', timezone: 'Asia/Kolkata' },
      { name: 'JST', timezone: 'Asia/Tokyo' },
    ];

    testCases.forEach((testCase) => {
      const localTime = now.tz(testCase.timezone);
      const result = this.getSecondsUntilTomorrow(localTime.toDate());
      console.log(`${testCase.name}: ${localTime.format()} -> ${result}`);
    });
  }
}
