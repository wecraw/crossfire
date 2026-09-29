import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { ScoreComponent } from './score.component';

describe('ScoreComponent', () => {
  let component: ScoreComponent;
  let fixture: ComponentFixture<ScoreComponent>;
  let frames: FrameRequestCallback[];

  //drives the count-up by hand: each rAF callback is queued and run on demand
  const runFrame = (now: number) => frames.shift()?.(now);

  const setScore = (score: number, firstChange = false) => {
    const previous = component.score;
    component.score = score;
    component.ngOnChanges({
      score: new SimpleChange(previous, score, firstChange),
    });
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    frames = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });

    fixture = TestBed.createComponent(ScoreComponent);
    component = fixture.componentInstance;
    component.maxScore = 700;
    fixture.detectChanges();
  });

  afterEach(() => vi.restoreAllMocks());

  it('shows a restored score without animating', () => {
    setScore(380, true);
    expect(component.displayScore).toBe(380);
    expect(component.gains).toEqual([]);
    expect(frames.length).toBe(0);
  });

  it('counts up to newly earned points and floats a +N', () => {
    setScore(100, true);
    setScore(180);

    expect(component.gains.map((g) => g.amount)).toEqual([80]);

    runFrame(0);
    runFrame(component.COUNT_MS / 2);
    expect(component.displayScore).toBeGreaterThan(100);
    expect(component.displayScore).toBeLessThan(180);

    runFrame(component.COUNT_MS);
    expect(component.displayScore).toBe(180);
  });

  it('snaps down on a reset', () => {
    setScore(420, true);
    setScore(0);
    expect(component.displayScore).toBe(0);
    expect(component.gains).toEqual([]);
  });

  it('drops the +N once its animation ends', () => {
    vi.useFakeTimers();
    setScore(0, true);
    setScore(60);
    expect(component.gains.length).toBe(1);
    vi.advanceTimersByTime(component.GAIN_MS);
    expect(component.gains.length).toBe(0);
    vi.useRealTimers();
  });
});
