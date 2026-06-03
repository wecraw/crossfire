import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  inject,
} from '@angular/core';
import moment from 'moment-timezone';
import { LevelReplay } from '../game/game.component';

export interface GameStats {
  maxStreak: string;
  totalGames: string;
  winPercent: number;
  currentStreak: string;
}

@Component({
  standalone: false,
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})
export class ModalComponent implements OnDestroy, OnInit, AfterViewInit {
  private elementRef = inject(ElementRef);

  @Input() decisionModal: boolean = false;
  @Input() primaryLabel: string = 'Confirm';
  @Input() secondaryLabel: string = 'Cancel';
  @Input() incorrectGuessesByLevel: number[];
  @Input() stats: GameStats;
  @Input() currentLevel: number;
  @Input() replays: LevelReplay[] = [];
  @Input() puzzleNumber?: number;

  @Output() secondaryEvent = new EventEmitter<void>();
  @Output() primaryEvent = new EventEmitter<void>();

  secondsUntilTomorrow: string;
  interval: ReturnType<typeof setInterval>;
  newDay: boolean = false;

  levels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  //page 0 is the summary (stats + breakdown); pages 1..N are per-level replays
  currentPage: number = 0;

  //locked to the summary page's height so the modal doesn't resize between pages
  @ViewChild('pages') pagesRef?: ElementRef<HTMLElement>;
  minPagesHeight: number | null = null;

  get totalPages(): number {
    return 1 + (this.replays?.length ?? 0);
  }

  //"Crawsword #123" tag (or "(practice)" when there's no daily puzzle number)
  get puzzleLabel(): string {
    return this.puzzleNumber != null ? '#' + this.puzzleNumber : '(practice)';
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
  }

  nextPage(): void {
    this.currentPage = (this.currentPage + 1) % this.totalPages;
  }

  prevPage(): void {
    this.currentPage = (this.currentPage - 1 + this.totalPages) % this.totalPages;
  }

  constructor() {}

  ngOnInit(): void {
    this.secondsUntilTomorrow = this.getSecondsUntilTomorrow();
    this.interval = setInterval(() => {
      this.secondsUntilTomorrow = this.getSecondsUntilTomorrow();
    }, 1000);
  }

  ngAfterViewInit(): void {
    //measure the summary page (current on first render) and pin it as a floor
    //so navigating to shorter replay pages doesn't shrink the modal
    setTimeout(() => {
      if (this.pagesRef) {
        this.minPagesHeight = this.pagesRef.nativeElement.offsetHeight;
      }
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.interval);
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
}
