import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { GameComponent, ILetter } from './game.component';

describe('GameComponent', () => {
  let component: GameComponent;
  let fixture: ComponentFixture<GameComponent>;

  // GameComponent uses inject() in field initializers, so instances must be
  // built inside the TestBed injection context rather than via `new`.
  function makeComponent(): GameComponent {
    const c = TestBed.createComponent(GameComponent).componentInstance;
    // canvas-confetti needs a real canvas (unavailable in jsdom); the win /
    // solve paths only fire visual effects, so stub them out everywhere.
    c.renderConfetti = () => undefined;
    c.renderWinConfetti = () => undefined;
    return c;
  }

  beforeEach(async () => {
    // GameComponent's template wires up many presentational child
    // components (app-square, app-keyboard, ...), all declared in AppModule.
    await TestBed.configureTestingModule({
      imports: [AppModule],
    }).compileComponents();

    fixture = TestBed.createComponent(GameComponent);
    component = fixture.componentInstance;
    component.renderConfetti = () => undefined;
    component.renderWinConfetti = () => undefined;
  });

  it('should create', () => {
    fixture.detectChanges(); // runs ngOnInit
    expect(component).toBeTruthy();
  });

  describe('daily clue selection (deterministic seeding)', () => {
    it('picks the same clue for a given day for every player', () => {
      const a = makeComponent();
      const b = makeComponent();

      // Pin "today" so the seed is stable regardless of when the test runs.
      const fixedDay = 20000;
      a.daysSinceEpoch = () => fixedDay;
      b.daysSinceEpoch = () => fixedDay;

      a.setClueSeeds();
      b.setClueSeeds();

      expect(a.clueSeeds).toEqual(b.clueSeeds);
      expect(a.clueSeeds.length).toBe(a.cluesArray.length);
    });

    it('picks different clues on different days', () => {
      const a = makeComponent();
      const b = makeComponent();
      a.daysSinceEpoch = () => 20000;
      b.daysSinceEpoch = () => 20001;

      a.setClueSeeds();
      b.setClueSeeds();

      expect(a.clueSeeds).not.toEqual(b.clueSeeds);
    });

    it('keeps every seed within the bounds of its clue set', () => {
      component.daysSinceEpoch = () => 20000;
      component.setClueSeeds();

      component.clueSeeds.forEach((seed, level) => {
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThan(component.cluesArray[level].length);
      });
    });

    it('can select the final clue in each practice-mode clue set', () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.999999);
      component.practiceMode = true;

      component.setClueSeeds();

      component.clueSeeds.forEach((seed, level) => {
        expect(seed).toBe(component.cluesArray[level].length - 1);
      });
      randomSpy.mockRestore();
    });

    it('ships only answers supported by the keyboard', () => {
      component.cluesArray.flat().forEach(([, , answer]) => {
        expect(answer).toMatch(/^[A-Z]+$/);
      });
    });
  });

  describe('checkAnswer scoring', () => {
    // Drive the component into a known single-level state with a fixed answer.
    function loadAnswer(answer: string) {
      component.daysSinceEpoch = () => 20000;
      component.clueSeeds = [0, 0, 0, 0, 0, 0, 0];
      component.currentLevel = 0;
      component.clue = { clueNumber: 1, clue: 'test', answer };
      component.setLetters(answer);
    }

    function enter(word: string) {
      [...word].forEach((ch, i) => (component.enteredLetters[i].letter = ch));
    }

    it('marks an exact match as all correct and advances the level', () => {
      loadAnswer('CAT');
      enter('CAT');

      const before = component.currentLevel;
      component.checkAnswer();

      expect(component.enteredLetters.map((l: ILetter) => l.state)).toEqual([
        'correct',
        'correct',
        'correct',
      ]);
      expect(component.currentLevel).toBe(before + 1);
      expect(component.incorrectGuesses).toBe(0);
    });

    it('marks present (right letter, wrong spot) and absent letters', () => {
      loadAnswer('CART');
      // answer C-A-R-T, guess T-R-A-P
      enter('TRAP');
      component.checkAnswer();

      // A wrong guess is recorded in submissions; enteredLetters is then reset.
      expect(component.submissions[0].map((l: ILetter) => l.state)).toEqual([
        'present', // T is in CART, not at index 0
        'present', // R is in CART, not at index 1
        'present', // A is in CART, but index 2 is R, not A
        'absent', // P not in CART
      ]);
    });

    it('does not over-credit a duplicate guessed letter beyond its count', () => {
      loadAnswer('CAT'); // a single A
      // guess AAA: index1 A is correct; the other two A's have no remaining A
      enter('AAA');
      component.checkAnswer();

      expect(component.submissions[0].map((l: ILetter) => l.state)).toEqual([
        'absent',
        'correct',
        'absent',
      ]);
    });

    it('counts a wrong guess and stays on the same level', () => {
      loadAnswer('CAT');
      enter('DOG');

      const level = component.currentLevel;
      component.checkAnswer();

      expect(component.incorrectGuesses).toBe(1);
      expect(component.incorrectGuessesByLevel[0]).toBe(1);
      expect(component.currentLevel).toBe(level);
      expect(component.submissions.length).toBe(1);
    });

    it('triggers a loss after MAX_INCORRECT_GUESSES wrong guesses', () => {
      loadAnswer('CAT');

      for (let i = 0; i < component.MAX_INCORRECT_GUESSES; i++) {
        enter('DOG'); // board is blank again after each non-final wrong guess
        component.checkAnswer();
      }

      expect(component.incorrectGuesses).toBe(component.MAX_INCORRECT_GUESSES);
      expect(component.hasLost).toBe(true);
    });

    it('rejects an incomplete guess without counting it', () => {
      loadAnswer('CAT');
      component.enteredLetters[0].letter = 'C'; // leave the rest blank

      component.checkAnswer();

      expect(component.incorrectGuesses).toBe(0);
      expect(component.invalidReason).toBe('Not enough letters');
    });
  });

  describe('puzzle number & share string', () => {
    it('numbers the puzzle relative to the first puzzle day', () => {
      component.daysSinceEpoch = () => component.PUZZLE_FIRST_DAY;
      expect(component.getPuzzleNumber()).toBe(1);

      component.daysSinceEpoch = () => component.PUZZLE_FIRST_DAY + 41;
      expect(component.getPuzzleNumber()).toBe(42);
    });

    it('builds a share string reflecting progress and incorrect guesses', () => {
      component.daysSinceEpoch = () => component.PUZZLE_FIRST_DAY; // puzzle #1
      component.practiceMode = false;
      component.hasWon = false;
      component.currentLevel = 2;
      component.incorrectGuessesByLevel = [1, 0, 0, 0, 0, 0, 0];

      // Avoid the real Web Share / clipboard APIs in jsdom.
      (navigator as unknown as { share?: unknown }).share = undefined;
      const writeText = vi.fn();
      Object.assign(navigator, { clipboard: { writeText } });

      component.share();

      const shared = writeText.mock.calls[0][0] as string;
      expect(shared).toContain('Crawsword #1 2/7');
      expect(shared).toContain('🟩❌'); // level 0 solved with one wrong guess
      expect(shared).toContain('🟨'); // current level marker
      expect(shared).toContain('⬛'); // future, unreached levels
    });
  });

  describe('keyboard input', () => {
    it('accepts letters and rejects unsupported physical keys', () => {
      expect(component.isLetterKey(new KeyboardEvent('keyup', { key: 'a' }))).toBe(
        true
      );
      expect(component.isLetterKey(new KeyboardEvent('keyup', { key: '?' }))).toBe(
        false
      );
      expect(component.isLetterKey(new KeyboardEvent('keyup', { key: '1' }))).toBe(
        false
      );
    });
  });

  describe('localStorage persistence', () => {
    it('detects a new day when the stored day is in the past', () => {
      component.daysSinceEpoch = () => 20000;
      localStorage.setItem('currentDay', '19999');
      expect(component.isNewDay()).toBe(true);

      localStorage.setItem('currentDay', '20000');
      expect(component.isNewDay()).toBe(false);
    });

    it('round-trips daily progress through localStorage', () => {
      component.daysSinceEpoch = () => 20000;
      component.practiceMode = false;
      component.currentLevel = 3;
      component.incorrectGuesses = 2;
      component.incorrectGuessesByLevel = [0, 1, 1, 0, 0, 0, 0];
      component.submissions = [[{ letter: 'A', state: 'absent' }]];
      component.hasWon = false;
      component.hasLost = false;

      component.updateLocalStorage();

      const fresh = makeComponent();
      fresh.loadFromLocalStorage();

      expect(fresh.currentLevel).toBe(3);
      expect(fresh.incorrectGuesses).toBe(2);
      expect(fresh.incorrectGuessesByLevel).toEqual([0, 1, 1, 0, 0, 0, 0]);
      expect(fresh.submissions).toEqual([[{ letter: 'A', state: 'absent' }]]);
    });

    it('does not write daily progress while in practice mode', () => {
      component.practiceMode = true;
      component.currentLevel = 5;
      component.updateLocalStorage();
      expect(localStorage.getItem('currentLevel')).toBeNull();
    });

    it('clears terminal state when starting a new daily puzzle', () => {
      localStorage.setItem('hasWon', 'true');
      localStorage.setItem('hasLost', 'true');

      component.resetLocalStorage();

      expect(localStorage.getItem('hasWon')).toBeNull();
      expect(localStorage.getItem('hasLost')).toBeNull();
    });
  });

  describe('lifetime statistics', () => {
    it('preserves total wins after a loss and initializes total guesses', () => {
      component.daysSinceEpoch = () => 20000;
      component.hasLost = true;
      component.currentLevel = 3;
      component.incorrectGuesses = 10;
      localStorage.setItem('totalWins', '4');

      component.updateStats();

      expect(localStorage.getItem('totalGamesPlayed')).toBe('1');
      expect(localStorage.getItem('totalWins')).toBe('4');
      expect(localStorage.getItem('totalGuesses')).toBe('10');
    });
  });
});
