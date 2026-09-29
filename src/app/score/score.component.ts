import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';

interface PointsGain {
  id: number;
  amount: number;
}

@Component({
  standalone: false,
  selector: 'app-score',
  templateUrl: './score.component.html',
  styleUrls: ['./score.component.scss']
})
export class ScoreComponent implements OnChanges, OnDestroy {

  @Input() score: number = 0;
  @Input() maxScore: number = 0;

  displayScore: number = 0; //the number on screen; counts up to `score`
  gains: PointsGain[] = []; //floating "+N" chips, removed once their animation ends

  COUNT_MS: number = 600;
  GAIN_MS: number = 1100; //mirrors the rise-and-fade in score.component.scss

  private frame: number = 0;
  private nextGainId: number = 0;
  private gainTimeouts: ReturnType<typeof setTimeout>[] = [];

  ngOnChanges(changes: SimpleChanges) {
    const change = changes['score'];
    if (!change) return;

    //a restored save or a reset shows its score as-is; only points earned
    //during play count up
    const from = this.displayScore;
    if (change.firstChange || this.score <= from) {
      this.snapTo(this.score);
      return;
    }

    this.addGain(this.score - from);
    if (this.reducedMotion()) this.snapTo(this.score);
    else this.countUp(from, this.score);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.frame);
    this.gainTimeouts.forEach(clearTimeout);
  }

  private snapTo(value: number) {
    cancelAnimationFrame(this.frame);
    this.displayScore = value;
  }

  private countUp(from: number, to: number) {
    cancelAnimationFrame(this.frame);
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const t = Math.min(1, (now - start) / this.COUNT_MS);
      const eased = 1 - Math.pow(1 - t, 3); //ease-out cubic: fast start, gentle landing
      this.displayScore = Math.round(from + (to - from) * eased);
      if (t < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private addGain(amount: number) {
    const gain = { id: this.nextGainId++, amount };
    this.gains.push(gain);
    this.gainTimeouts.push(
      setTimeout(() => {
        this.gains = this.gains.filter((g) => g !== gain);
      }, this.GAIN_MS)
    );
  }

  private reducedMotion(): boolean {
    return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }
}
