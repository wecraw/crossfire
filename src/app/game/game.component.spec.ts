import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { GameComponent, ILetter } from './game.component';
import { dailyChains } from '../clues/chains';

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

  describe('daily chain selection', () => {
    it('picks the same chain for a given puzzle number for every player', () => {
      const a = makeComponent();
      const b = makeComponent();

      const fixedDay = 20000;
      a.daysSinceEpoch = () => fixedDay;
      b.daysSinceEpoch = () => fixedDay;

      a.setChain();
      b.setChain();

      expect(a.chain).toEqual(b.chain);
      expect(a.chain.length).toBe(a.NUM_LEVELS);
    });

    it('cycles through the chain list by puzzle number', () => {
      const a = makeComponent();
      a.daysSinceEpoch = () => a.PUZZLE_FIRST_DAY; // puzzle #1 -> index 0
      a.setChain();
      expect(a.chain).toEqual(dailyChains[0]);

      a.daysSinceEpoch = () => a.PUZZLE_FIRST_DAY + 1; // puzzle #2 -> index 1
      a.setChain();
      expect(a.chain).toEqual(dailyChains[1]);
    });
  });

  describe('chain data integrity', () => {
    it('ships only 5-letter A-Z answers', () => {
      for (const chain of dailyChains) {
        for (const [answer] of chain) {
          expect(answer).toMatch(/^[A-Z]{5}$/);
        }
      }
    });

    it('links every level to the previous via the carried letter', () => {
      for (const chain of dailyChains) {
        expect(chain.length).toBe(7);
        expect(chain[0][1]).toBe(-1); // Monday has no given letter
        for (let d = 1; d < 7; d++) {
          const [answer, carryPos] = chain[d];
          expect(carryPos).toBeGreaterThanOrEqual(0);
          expect(carryPos).toBeLessThan(5);
          // shared letter sits at the same column in both words
          expect(answer[carryPos]).toBe(chain[d - 1][0][carryPos]);
        }
      }
    });

    it('never repeats a word within a chain', () => {
      for (const chain of dailyChains) {
        const answers = chain.map((level) => level[0]);
        expect(new Set(answers).size).toBe(answers.length);
      }
    });
  });

  describe('loadLevel', () => {
    it('resolves the clue and prefills the carried letter as a locked given', () => {
      component.buildClueMaps();
      component.chain = dailyChains[0];
      component.loadLevel(1);

      const [answer, carryPos] = dailyChains[0][1];
      expect(component.answer).toBe(answer);
      expect(component.clue.answer).toBe(answer);
      expect(component.givenPos).toBe(carryPos);
      expect(component.givenLetter).toBe(answer[carryPos]);

      const given = component.board[0][carryPos];
      expect(given.letter).toBe(answer[carryPos]);
      expect(given.state).toBe('correct');
      expect(given.locked).toBe(true);
      // the cursor starts on the first non-locked cell
      expect(component.currentCol).not.toBe(carryPos);
    });
  });

  describe('checkAnswer scoring', () => {
    // Drive the component into a known single-level state with a fixed answer.
    function loadAnswer(answer: string, givenPos = -1) {
      component.answer = answer;
      component.givenPos = givenPos;
      component.givenLetter = givenPos >= 0 ? answer[givenPos] : '';
      component.currentLevel = 0;
      component.currentRow = 0;
      component.clue = { clueNumber: 1, clue: 'test', answer };
      component.incorrectGuesses = 0;
      component.board = [];
      for (let r = 0; r < component.MAX_INCORRECT_GUESSES; r++) {
        const row: ILetter[] = [];
        for (let c = 0; c < answer.length; c++) {
          row.push({ letter: '', state: 'default' });
        }
        component.board.push(row);
      }
      if (givenPos >= 0) {
        component.board[0][givenPos] = {
          letter: answer[givenPos],
          state: 'correct',
          locked: true,
        };
      }
      component.currentCol = givenPos === 0 ? 1 : 0;
    }

    // Fill the active row with a guessed word.
    function enter(word: string) {
      [...word].forEach(
        (ch, i) => (component.board[component.currentRow][i].letter = ch)
      );
    }

    it('marks an exact match as all correct and advances the level', () => {
      loadAnswer('CRANE');
      enter('CRANE');

      const before = component.currentLevel;
      component.checkAnswer();

      expect(component.board[0].map((l) => l.state)).toEqual([
        'correct',
        'correct',
        'correct',
        'correct',
        'correct',
      ]);
      expect(component.currentLevel).toBe(before + 1);
      expect(component.incorrectGuesses).toBe(0);
    });

    it('marks present (right letter, wrong spot) and absent letters', () => {
      loadAnswer('CARTS');
      enter('TRAPS'); // C-A-R-T-S vs T-R-A-P-S
      component.checkAnswer();

      expect(component.board[0].map((l) => l.state)).toEqual([
        'present', // T is in CARTS, not at index 0
        'present', // R is in CARTS, not at index 1
        'present', // A is in CARTS, not at index 2
        'absent', // P not in CARTS
        'correct', // S matches
      ]);
    });

    it('does not over-credit a duplicate guessed letter beyond its count', () => {
      loadAnswer('CRANE'); // a single A (index 2)
      enter('AAAAA');
      component.checkAnswer();

      expect(component.board[0].map((l) => l.state)).toEqual([
        'absent',
        'absent',
        'correct',
        'absent',
        'absent',
      ]);
    });

    it('counts a wrong guess and advances to the next row on the same level', () => {
      loadAnswer('CRANE');
      enter('DUMPS'); // no shared letters

      const level = component.currentLevel;
      component.checkAnswer();

      expect(component.incorrectGuesses).toBe(1);
      expect(component.incorrectGuessesByLevel[0]).toBe(1);
      expect(component.currentLevel).toBe(level);
      expect(component.currentRow).toBe(1);
    });

    it('triggers a loss after MAX_INCORRECT_GUESSES wrong guesses', () => {
      loadAnswer('CRANE');

      for (let i = 0; i < component.MAX_INCORRECT_GUESSES; i++) {
        enter('DUMPS');
        component.checkAnswer();
      }

      expect(component.incorrectGuessesByLevel[0]).toBe(
        component.MAX_INCORRECT_GUESSES
      );
      expect(component.currentRow).toBe(component.MAX_INCORRECT_GUESSES);
      expect(component.hasLost).toBe(true);
    });

    it('rejects an incomplete guess without counting it', () => {
      loadAnswer('CRANE');
      component.board[0][0].letter = 'C'; // leave the rest blank

      component.checkAnswer();

      expect(component.incorrectGuesses).toBe(0);
      expect(component.invalidReason).toBe('Not enough letters');
    });
  });

  describe('locked given letter input', () => {
    function loadWithGiven(answer: string, givenPos: number) {
      component.answer = answer;
      component.givenPos = givenPos;
      component.givenLetter = answer[givenPos];
      component.currentLevel = 0;
      component.currentRow = 0;
      component.incorrectGuesses = 0;
      component.board = [];
      for (let r = 0; r < component.MAX_INCORRECT_GUESSES; r++) {
        const row: ILetter[] = [];
        for (let c = 0; c < answer.length; c++) {
          row.push({ letter: '', state: 'default' });
        }
        component.board.push(row);
      }
      component.board[0][givenPos] = {
        letter: answer[givenPos],
        state: 'correct',
        locked: true,
      };
      component.currentCol = givenPos === 0 ? 1 : 0;
    }

    it('skips the locked cell while typing and never overwrites it', () => {
      loadWithGiven('CRANE', 2); // given A at index 2
      expect(component.currentCol).toBe(0);

      component.handleLetterEntry('X'); // index 0 -> cursor to 1
      expect(component.currentCol).toBe(1);
      component.handleLetterEntry('Y'); // index 1 -> cursor skips 2, lands on 3
      expect(component.currentCol).toBe(3);

      expect(component.board[0][2].letter).toBe('A'); // given untouched
      expect(component.board[0][2].locked).toBe(true);
      expect(component.board[0][0].letter).toBe('X');
      expect(component.board[0][1].letter).toBe('Y');
    });

    it('backspace cannot clear the locked given', () => {
      loadWithGiven('CRANE', 2);
      component.currentCol = 2; // pretend cursor is on the locked cell
      component.handleDeleteLetter();
      expect(component.board[0][2].letter).toBe('A');
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
      expect(
        component.isLetterKey(new KeyboardEvent('keyup', { key: 'a' }))
      ).toBe(true);
      expect(
        component.isLetterKey(new KeyboardEvent('keyup', { key: '?' }))
      ).toBe(false);
      expect(
        component.isLetterKey(new KeyboardEvent('keyup', { key: '1' }))
      ).toBe(false);
    });
  });

  describe('localStorage persistence', () => {
    it('detects a new day when the stored day is in the past', () => {
      component.daysSinceEpoch = () => 20000;
      localStorage.setItem('v3:currentDay', '19999');
      expect(component.isNewDay()).toBe(true);

      localStorage.setItem('v3:currentDay', '20000');
      expect(component.isNewDay()).toBe(false);
    });

    it('round-trips the in-progress board through localStorage', () => {
      component.daysSinceEpoch = () => 20000;
      component.practiceMode = false;
      component.currentLevel = 3;
      component.currentRow = 1;
      component.incorrectGuesses = 2;
      component.incorrectGuessesByLevel = [0, 1, 1, 0, 0, 0, 0];
      // a saved in-progress board (4 rows = the remaining budget after 2 wrong),
      // with one scored guess on row 0
      const savedBoard: ILetter[][] = [];
      for (let r = 0; r < component.MAX_INCORRECT_GUESSES - 2; r++) {
        const row: ILetter[] = [];
        for (let c = 0; c < 5; c++) row.push({ letter: '', state: 'default' });
        savedBoard.push(row);
      }
      savedBoard[0] = [
        { letter: 'C', state: 'absent' },
        { letter: 'R', state: 'present' },
        { letter: 'A', state: 'absent' },
        { letter: 'N', state: 'absent' },
        { letter: 'E', state: 'present' },
      ];
      component.board = savedBoard;
      component.hasWon = false;
      component.hasLost = false;

      component.updateLocalStorage();

      const fresh = makeComponent();
      fresh.daysSinceEpoch = () => 20000;
      fresh.buildClueMaps();
      fresh.setChain();
      const resumed = fresh.loadFromLocalStorage();

      expect(resumed).toBe(true);
      expect(fresh.currentLevel).toBe(3);
      expect(fresh.currentRow).toBe(1);
      expect(fresh.incorrectGuesses).toBe(2);
      expect(fresh.incorrectGuessesByLevel).toEqual([0, 1, 1, 0, 0, 0, 0]);
      expect(fresh.board).toEqual(savedBoard);
    });

    it('does not write daily progress while in practice mode', () => {
      component.practiceMode = true;
      component.currentLevel = 5;
      component.updateLocalStorage();
      expect(localStorage.getItem('v3:currentLevel')).toBeNull();
    });

    it('clears terminal state when starting a new daily puzzle', () => {
      localStorage.setItem('v3:hasWon', 'true');
      localStorage.setItem('v3:hasLost', 'true');

      component.resetLocalStorage();

      expect(localStorage.getItem('v3:hasWon')).toBeNull();
      expect(localStorage.getItem('v3:hasLost')).toBeNull();
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
