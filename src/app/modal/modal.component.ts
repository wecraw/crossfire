import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import moment from 'moment-timezone';
import { LevelReplay } from '../game/game.component';

export interface GameStats {
  totalGames: string;
  averageScore: number;
  bestScore: number;
  currentStreak: string;
  maxStreak: string;
}

//today's standing among all players, from the stats backend
export interface DailyRank {
  total: number;
  topPercent: number;
}

//the day's first player has no one to compare against, so they get a
//friendly default instead of the backend's "top 100%"; "top 0%" is never
//shown, so the value is floored at 1
export function rankPercent(rank: DailyRank): number {
  return rank.total <= 1 ? 1 : Math.max(1, rank.topPercent);
}

@Component({
  standalone: false,
  selector: 'app-modal',
  templateUrl: './modal.component.html',
  styleUrls: ['./modal.component.scss'],
})
export class ModalComponent implements OnDestroy, OnInit {
  @Input() decisionModal: boolean = false;
  @Input() primaryLabel: string = 'Confirm';
  @Input() secondaryLabel: string = 'Cancel';
  @Input() incorrectGuessesByLevel: number[];
  @Input() failedByLevel: boolean[] = [];
  @Input() stats: GameStats;
  @Input() currentLevel: number;
  @Input() replays: LevelReplay[] = [];
  @Input() puzzleNumber?: number;
  @Input() score: number = 0;
  @Input() maxScore: number = 0;
  @Input() levelScores: number[] = [];
  @Input() hintsByLevel: number[][] = [];
  @Input() dailyRank: DailyRank | null = null;
  @Input() rankLoading: boolean = false;
  //replay boards reserve this many guess rows so every page is the same height
  @Input() guessesPerLevel: number = 5;

  @Output() secondaryEvent = new EventEmitter<void>();
  @Output() primaryEvent = new EventEmitter<void>();

  secondsUntilTomorrow: string;
  interval: ReturnType<typeof setInterval>;
  newDay: boolean = false;

  levels = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

  //page 0 is the summary (score, day tiles, stats); pages 1..N are per-level replays
  currentPage: number = 0;
  //the page sliding out while currentPage slides in; cleared when its exit ends
  leavingPage: number | null = null;
  direction: 'forward' | 'back' = 'forward';
  //off until the first page turn, so the modal doesn't animate its opening page
  animated: boolean = false;

  get totalPages(): number {
    return 1 + (this.replays?.length ?? 0);
  }

  get rankPercent(): number {
    return this.dailyRank ? rankPercent(this.dailyRank) : 0;
  }

  //"Crawsword #123" tag (or "(practice)" when there's no daily puzzle number)
  get puzzleLabel(): string {
    return this.puzzleNumber != null ? '#' + this.puzzleNumber : '(practice)';
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.turnTo(page, page > this.currentPage ? 'forward' : 'back');
  }

  //arrows wrap around, still sliding in the direction of the arrow pressed
  nextPage(): void {
    this.turnTo((this.currentPage + 1) % this.totalPages, 'forward');
  }

  prevPage(): void {
    this.turnTo((this.currentPage - 1 + this.totalPages) % this.totalPages, 'back');
  }

  onPageAnimationEnd(event: AnimationEvent, page: number): void {
    //ignore animations bubbling up from inside the page (e.g. squares)
    if (event.target !== event.currentTarget) return;
    if (this.leavingPage === page) this.leavingPage = null;
  }

  private turnTo(page: number, direction: 'forward' | 'back'): void {
    if (page === this.currentPage) return;
    this.leavingPage = this.currentPage;
    this.direction = direction;
    this.currentPage = page;
    this.animated = true;
  }

  constructor() {}

  ngOnInit(): void {
    this.secondsUntilTomorrow = this.getSecondsUntilTomorrow();
    this.interval = setInterval(() => {
      this.secondsUntilTomorrow = this.getSecondsUntilTomorrow();
    }, 1000);
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
