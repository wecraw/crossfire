import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppModule } from '../app.module';
import { GameComponent, ILetter } from './game.component';
import { dailyChains } from '../clues/chains';
import { environment } from '../../environments/environment';

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

  it.each(['Q', 'CHECK', 'BKSP'])(
    'submits without activating a focused virtual %s key',
    (label) => {
      fixture.detectChanges();
      component.guessNotAllowed = false;
      component.hasWon = false;
      const keyboard = fixture.nativeElement.querySelector('app-keyboard');
      const buttons = Array.from(keyboard.querySelectorAll('button')) as HTMLButtonElement[];
      const button = label === 'BKSP'
        ? buttons[buttons.length - 1]
        : buttons.find((key) => key.textContent?.trim() === label)!;
      const virtualKeypress = vi.spyOn(component, 'handleVirtualKeypress');
      const submit = vi.spyOn(component, 'checkAnswer').mockImplementation(() => undefined);
      button.focus();
      expect(document.activeElement).toBe(button);

      const keydown = new KeyboardEvent('keydown', {
        key: 'Enter', bubbles: true, cancelable: true,
      });
      // jsdom doesn't perform native keyboard activation, so model its default action.
      if (button.dispatchEvent(keydown)) button.click();
      button.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));

      expect(keydown.defaultPrevented).toBe(true);
      expect(virtualKeypress).not.toHaveBeenCalled();
      expect(submit).toHaveBeenCalledTimes(1);
    },
  );

  describe('daily chain selection', () => {
    it('picks the same chain for a given puzzle number for every player', () => {
      const a = makeComponent();
      const b = makeComponent();

      const fixedDay = a.PUZZLE_FIRST_DAY + 91; // a real puzzle day (index in range)
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
        // Monday's given is a standalone reveal (0..4), not a carried link.
        expect(chain[0][1]).toBeGreaterThanOrEqual(0);
        expect(chain[0][1]).toBeLessThan(5);
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
      for (let r = 0; r < component.GUESSES_PER_LEVEL; r++) {
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

    // checkAnswer now grades synchronously but defers the win/loss/advance
    // outcome until the flip reveal finishes; flush past that timeout to assert
    // the result. Stays short of handleCorrect's later slide/loadLevel timers.
    function flushReveal() {
      vi.advanceTimersByTime(
        (component.answer.length - 1) * component.FLIP_STAGGER_MS +
          component.FLIP_DURATION_MS +
          1
      );
    }

    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

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
      flushReveal();
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
      flushReveal();

      expect(component.incorrectGuesses).toBe(1);
      expect(component.incorrectGuessesByLevel[0]).toBe(1);
      expect(component.currentLevel).toBe(level);
      expect(component.currentRow).toBe(1);
    });

    it('reveals the answer and advances (no game-over) after a level is exhausted', () => {
      component.buildClueMaps();
      component.chain = dailyChains[0];
      loadAnswer('CRANE');

      for (let i = 0; i < component.GUESSES_PER_LEVEL; i++) {
        enter('DUMPS');
        component.checkAnswer();
        flushReveal();
      }

      expect(component.incorrectGuessesByLevel[0]).toBe(
        component.GUESSES_PER_LEVEL
      );
      // the level is flagged failed and the game moves on rather than ending
      expect(component.failedByLevel[0]).toBe(true);
      expect(component.currentLevel).toBe(1);
      expect(component.hasWon).toBe(false);
    });

    it('commits the failed level to storage before the flip reveal completes', () => {
      component.buildClueMaps();
      component.chain = dailyChains[0];
      loadAnswer('CRANE');

      // burn every guess but the last, flushing each flip reveal
      for (let i = 0; i < component.GUESSES_PER_LEVEL - 1; i++) {
        enter('DUMPS'); // no shared letters with CRANE
        component.checkAnswer();
        flushReveal();
      }
      expect(component.failedByLevel[0]).toBe(false);

      // submit the final (losing) guess but do NOT flush the flip animation --
      // this is the ~1.25-1.5s reload window the commit-before-flip fix closes
      enter('DUMPS');
      component.checkAnswer();

      // storage already reflects the failed + advanced state mid-flip, so a
      // reload here can't hand back the final guess or keep a stale flawless run
      expect(JSON.parse(localStorage.getItem('v3:failedByLevel')!)[0]).toBe(true);
      expect(localStorage.getItem('v3:currentLevel')).toBe('1');
      expect(localStorage.getItem('v3:currentRow')).toBe('0');
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
      for (let r = 0; r < component.GUESSES_PER_LEVEL; r++) {
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

    it('only locks the given on the first row; later rows start empty', () => {
      vi.useFakeTimers();
      loadWithGiven('CRANE', 2);
      component.clue = { clueNumber: 1, clue: 'test', answer: 'CRANE' };
      ['D', 'U', 'M', 'P'].forEach((ch) => component.handleLetterEntry(ch));
      component.checkAnswer();
      vi.advanceTimersByTime(
        3 * component.FLIP_STAGGER_MS + component.FLIP_DURATION_MS + 1
      );
      vi.useRealTimers();

      expect(component.currentRow).toBe(1);
      expect(component.board[1].every((c) => c.letter === '' && !c.locked)).toBe(
        true
      );
      expect(component.currentCol).toBe(0);
      // the cursor no longer skips column 2 on this row
      component.handleLetterEntry('X');
      component.handleLetterEntry('Y');
      expect(component.currentCol).toBe(2);
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

    function shareText(): string {
      (navigator as unknown as { share?: unknown }).share = undefined;
      const writeText = vi.fn();
      Object.assign(navigator, { clipboard: { writeText } });
      component.share();
      return writeText.mock.calls[0][0] as string;
    }

    it('builds a share string with the score, revealed levels and hints', () => {
      component.daysSinceEpoch = () => component.PUZZLE_FIRST_DAY; // puzzle #1
      component.practiceMode = false;
      component.currentLevel = component.NUM_LEVELS;
      component.incorrectGuessesByLevel = [1, 5, 0, 2, 0, 0, 0];
      component.failedByLevel = [false, true, false, false, false, false, false];
      component.hintsByLevel = [[], [], [3], [], [], [], []];
      // 80 + 0 + 100 + 60 + 100 + 100 + 100
      expect(component.score).toBe(540);

      const shared = shareText();
      expect(shared).toContain('Crawsword #1  540/700');
      expect(shared).not.toContain('🏆'); // not flawless
      expect(shared).toContain('🟩❌'); // level 0 solved with one wrong guess
      expect(shared).toContain('🟥'); // level 1 revealed
      expect(shared).toContain('🟩💡'); // level 2 solved with a hint
    });

    it('awards the trophy on a flawless run', () => {
      component.daysSinceEpoch = () => component.PUZZLE_FIRST_DAY;
      component.practiceMode = false;
      component.currentLevel = component.NUM_LEVELS;
      component.incorrectGuessesByLevel = [0, 0, 1, 0, 0, 0, 0];
      component.failedByLevel = [false, false, false, false, false, false, false];

      const shared = shareText();
      expect(shared).toContain('Crawsword #1  680/700 🏆');
      expect(shared).not.toContain('🟥');
    });
  });

  describe('scoring', () => {
    it('scores a level by guesses used', () => {
      component.currentLevel = component.NUM_LEVELS;
      component.failedByLevel = [false, false, false, false, false, false, false];
      component.incorrectGuessesByLevel = [0, 1, 2, 3, 0, 0, 4];

      expect(component.levelScores).toEqual([100, 80, 60, 40, 100, 100, 20]);
      expect(component.score).toBe(500);
      expect(component.MAX_SCORE).toBe(700);
    });

    it('scores revealed and unfinished levels as zero', () => {
      component.currentLevel = 3; // levels 3..6 not reached yet
      component.failedByLevel = [false, true, false, false, false, false, false];
      component.incorrectGuessesByLevel = [0, 5, 1, 0, 0, 0, 0];

      expect(component.levelScores).toEqual([100, 0, 80, 0, 0, 0, 0]);
      expect(component.score).toBe(180);
    });
  });

  describe('hints', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      component.buildClueMaps();
      component.chain = [
        ['CRANE', 2], ['SCARE', 1], ['SCARE', 1], ['SCARE', 1],
        ['SCARE', 1], ['SCARE', 1], ['SCARE', 1],
      ];
      component.currentLevel = 0;
      component.loadLevel(0); // given A at column 2
      component.guessNotAllowed = false;
    });
    afterEach(() => vi.useRealTimers());

    it('locks a correct letter in the active row, never the given', () => {
      for (let i = 0; i < 20; i++) {
        component.hintsByLevel[0] = [];
        component.loadLevel(0);
        component.useHint();
        const [pos] = component.hintsByLevel[0];
        expect(pos).not.toBe(2);
        expect(component.board[0][pos]).toEqual({
          letter: 'CRANE'[pos],
          state: 'correct',
          locked: true,
        });
        expect(component.correctLetters).toContain('CRANE'[pos]);
      }
    });

    it('decrements the pool and is ignored once it is empty', () => {
      component.useHint();
      component.useHint();
      expect(component.hintsRemaining).toBe(0);
      expect(component.canHint).toBe(false);

      component.useHint();
      expect(component.hintsByLevel[0].length).toBe(2);
    });

    it('skips columns the player has already solved', () => {
      // a graded guess already found C, R, N (plus the given A); only E is left
      component.guessHistoryByLevel[0] = [[
        { letter: 'C', state: 'correct' },
        { letter: 'R', state: 'correct' },
        { letter: 'A', state: 'correct', locked: true },
        { letter: 'N', state: 'correct' },
        { letter: 'X', state: 'absent' },
      ]];
      component.useHint();
      expect(component.hintsByLevel[0]).toEqual([4]);

      // nothing left to reveal: the hint is not spent
      component.guessHistoryByLevel[0][0][4] = { letter: 'E', state: 'correct' };
      component.useHint();
      expect(component.hintsByLevel[0]).toEqual([4]);
      expect(component.hintsRemaining).toBe(1);
    });

    it('moves the cursor off a newly locked cell', () => {
      vi.spyOn(component, 'getRandomInt').mockReturnValue(0); // first candidate: col 0
      component.currentCol = 0;
      component.useHint();
      expect(component.hintsByLevel[0]).toEqual([0]);
      expect(component.currentCol).toBe(1);
    });

    it('locks the hint only on its own row; later rows start empty', () => {
      vi.spyOn(component, 'getRandomInt').mockReturnValue(0); // reveal C
      component.useHint();
      ['X', 'Y', 'Z', 'Q'].forEach((ch) => component.handleLetterEntry(ch));
      component.checkAnswer();
      vi.advanceTimersByTime(5000);

      expect(component.currentRow).toBe(1);
      expect(component.board[1].every((c) => c.letter === '' && !c.locked)).toBe(
        true
      );
      expect(component.currentCol).toBe(0);
      // the hinted letter stays green on the keyboard
      expect(component.correctLetters).toContain('C');
    });

    it('a hint on a later row locks just that row, not the given', () => {
      ['X', 'Y', 'Z', 'Q'].forEach((ch) => component.handleLetterEntry(ch));
      component.checkAnswer();
      vi.advanceTimersByTime(5000);

      vi.spyOn(component, 'getRandomInt').mockReturnValue(0); // reveal C
      component.useHint();
      expect(component.hintsByLevel[0]).toEqual([0]);
      expect(component.board[1][0]).toEqual({ letter: 'C', state: 'correct', locked: true });
      expect(component.board[1][2].locked).toBeFalsy(); // the given doesn't re-lock
      expect(component.currentCol).toBe(1);
    });

    it('skips hinted columns in the flip-reveal stagger', () => {
      vi.spyOn(component, 'getRandomInt').mockReturnValue(0); // reveal C
      component.useHint();
      // locked columns 0 and 2: col 1 flips first, col 3 second, col 4 third
      expect(component.revealDelay(0, 1)).toBe('0ms');
      expect(component.revealDelay(0, 3)).toBe(component.FLIP_STAGGER_MS + 'ms');
      expect(component.revealDelay(0, 4)).toBe(2 * component.FLIP_STAGGER_MS + 'ms');
    });

    it('clears hints on restart', () => {
      component.useHint();
      component.reset();
      expect(component.hintsRemaining).toBe(component.HINTS_PER_GAME);
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
      const day = component.PUZZLE_FIRST_DAY + 91; // a real puzzle day (index in range)
      component.daysSinceEpoch = () => day;
      component.practiceMode = false;
      component.currentLevel = 3;
      component.currentRow = 1;
      component.incorrectGuesses = 2;
      component.incorrectGuessesByLevel = [0, 1, 1, 0, 0, 0, 0];
      component.failedByLevel = [false, true, false, false, false, false, false];
      // a saved in-progress board for the current level, with one scored guess
      const savedBoard: ILetter[][] = [];
      for (let r = 0; r < component.GUESSES_PER_LEVEL; r++) {
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

      component.updateLocalStorage();

      const fresh = makeComponent();
      fresh.daysSinceEpoch = () => day;
      fresh.buildClueMaps();
      fresh.setChain();
      const resumed = fresh.loadFromLocalStorage();

      expect(resumed).toBe(true);
      expect(fresh.currentLevel).toBe(3);
      expect(fresh.currentRow).toBe(1);
      expect(fresh.incorrectGuesses).toBe(2);
      expect(fresh.incorrectGuessesByLevel).toEqual([0, 1, 1, 0, 0, 0, 0]);
      expect(fresh.failedByLevel).toEqual([
        false, true, false, false, false, false, false,
      ]);
      expect(fresh.board).toEqual(savedBoard);
    });

    it('round-trips used hints and defaults to none for older saves', () => {
      const day = component.PUZZLE_FIRST_DAY + 91;
      component.daysSinceEpoch = () => day;
      component.practiceMode = false;
      component.buildClueMaps();
      component.setChain();
      component.loadLevel(0);
      component.hintsByLevel = [[1], [], [], [], [], [], []];
      component.updateLocalStorage();

      const fresh = makeComponent();
      fresh.daysSinceEpoch = () => day;
      fresh.buildClueMaps();
      fresh.setChain();
      fresh.loadFromLocalStorage();
      expect(fresh.hintsByLevel).toEqual([[1], [], [], [], [], [], []]);
      expect(fresh.hintsRemaining).toBe(1);

      localStorage.removeItem('v3:hintsByLevel');
      const legacy = makeComponent();
      legacy.daysSinceEpoch = () => day;
      legacy.buildClueMaps();
      legacy.setChain();
      legacy.loadFromLocalStorage();
      expect(legacy.hintsByLevel).toEqual([[], [], [], [], [], [], []]);
      expect(legacy.hintsRemaining).toBe(2);
    });

    it('resumes a hint-saved partial draft at its first empty cell', () => {
      const day = component.PUZZLE_FIRST_DAY + 91;
      component.daysSinceEpoch = () => day;
      component.practiceMode = false;
      component.buildClueMaps();
      component.setChain();
      component.loadLevel(0);
      component.guessNotAllowed = false;
      const given = component.lockedPositions[0];

      // type two letters, then hint (which saves the partial row); the hint
      // takes the last candidate column so it never lands on the draft
      vi.spyOn(component, 'getRandomInt').mockImplementation((n) => n - 1);
      component.handleLetterEntry('X');
      component.handleLetterEntry('Y');
      component.useHint();
      const expected = component.currentCol;
      expect(component.board[0][expected].letter).toBe('');

      const fresh = makeComponent();
      fresh.daysSinceEpoch = () => day;
      fresh.buildClueMaps();
      fresh.setChain();
      fresh.loadFromLocalStorage();
      expect(fresh.currentCol).toBe(expected);

      // the next keystroke extends the draft rather than overwriting it
      fresh.handleLetterEntry('Z');
      const typed = fresh.board[0]
        .filter((c, i) => !c.locked && i !== given && c.letter !== '')
        .map((c) => c.letter);
      expect(typed).toEqual(['X', 'Y', 'Z']);
    });

    it('discards a legacy same-day save that predates the current schema', () => {
      const day = component.PUZZLE_FIRST_DAY + 91;
      component.daysSinceEpoch = () => day;
      component.practiceMode = false;
      component.buildClueMaps();
      component.setChain();

      // an in-progress save from an older build: valid-looking keys, but no
      // schema stamp (older builds never wrote one). Its board may encode a
      // different chain/row count, so it must not be restored.
      localStorage.setItem('v3:currentDay', '' + day);
      localStorage.setItem('v3:currentLevel', '4');
      localStorage.setItem('v3:currentRow', '2');
      localStorage.setItem(
        'v3:board',
        JSON.stringify([[{ letter: 'X', state: 'absent' }]])
      );

      const resumed = component.loadFromLocalStorage();

      expect(resumed).toBe(false);
      expect(component.currentLevel).toBe(0); // stale level not adopted
      expect(localStorage.getItem('v3:board')).toBeNull(); // reset cleared it
      expect(localStorage.getItem('v3:schema')).toBe(component.SCHEMA_VERSION);
    });

    it('persists the failed level result immediately, before the reveal delay', () => {
      const day = component.PUZZLE_FIRST_DAY + 91;
      component.daysSinceEpoch = () => day;
      component.practiceMode = false;
      component.buildClueMaps();
      component.setChain();
      component.currentLevel = 2;
      component.loadLevel(2);
      component.currentRow = component.GUESSES_PER_LEVEL - 1; // final guess row

      // the guess pool is exhausted on the current level
      (component as unknown as { handleLevelFailed(): void }).handleLevelFailed();

      // storage reflects the advance right away, not only after the 2.5s reveal
      expect(localStorage.getItem('v3:currentLevel')).toBe('3');
      expect(localStorage.getItem('v3:currentRow')).toBe('0');
      expect(
        JSON.parse(localStorage.getItem('v3:failedByLevel')!)[2]
      ).toBe(true);
      // the saved board is a fresh next-level board (at most the carried given
      // is pre-filled), never the just-failed board
      const savedBoard: ILetter[][] = JSON.parse(
        localStorage.getItem('v3:board')!
      );
      expect(savedBoard.length).toBe(component.GUESSES_PER_LEVEL);
      const filledCells = savedBoard
        .flat()
        .filter((cell) => cell.letter).length;
      expect(filledCells).toBeLessThanOrEqual(1);
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
    it('does not count a non-flawless run as a win but initializes total guesses', () => {
      component.daysSinceEpoch = () => 20000;
      component.failedByLevel = [false, false, false, true, false, false, false];
      component.currentLevel = component.NUM_LEVELS;
      component.incorrectGuesses = 10;
      localStorage.setItem('totalWins', '4');

      component.updateStats();

      expect(localStorage.getItem('totalGamesPlayed')).toBe('1');
      expect(localStorage.getItem('totalWins')).toBe('4'); // unchanged: not flawless
      expect(localStorage.getItem('totalGuesses')).toBe('10');
    });

    it('counts a flawless run as a win and extends the streak', () => {
      component.daysSinceEpoch = () => 20000;
      component.failedByLevel = [false, false, false, false, false, false, false];
      component.currentLevel = component.NUM_LEVELS;
      component.incorrectGuesses = 2;
      localStorage.setItem('totalWins', '4');
      localStorage.setItem('streak', '3');
      localStorage.setItem('streakLastPuzzle', '' + (component.getPuzzleNumber() - 1));

      component.updateStats();

      expect(localStorage.getItem('totalWins')).toBe('5');
      expect(localStorage.getItem('streak')).toBe('4');
    });

    it('extends the play streak even when a level was revealed', () => {
      component.daysSinceEpoch = () => 20000;
      component.failedByLevel = [true, true, false, false, false, false, false];
      component.currentLevel = component.NUM_LEVELS;
      localStorage.setItem('streak', '3');
      localStorage.setItem('maxStreak', '3');
      localStorage.setItem('streakLastPuzzle', '' + (component.getPuzzleNumber() - 1));

      component.updateStats();

      expect(localStorage.getItem('streak')).toBe('4');
      expect(localStorage.getItem('maxStreak')).toBe('4');
    });

    it('restarts the streak at 1 after a missed day', () => {
      component.daysSinceEpoch = () => 20000;
      component.currentLevel = component.NUM_LEVELS;
      localStorage.setItem('streak', '9');
      localStorage.setItem('maxStreak', '9');
      localStorage.setItem('streakLastPuzzle', '' + (component.getPuzzleNumber() - 2));

      component.updateStats();

      expect(localStorage.getItem('streak')).toBe('1');
      expect(localStorage.getItem('maxStreak')).toBe('9');
    });

    it('tracks average and best score, and records a game only once', () => {
      component.daysSinceEpoch = () => 20000;
      component.currentLevel = component.NUM_LEVELS;
      component.incorrectGuessesByLevel = [0, 0, 0, 0, 0, 0, 0];
      component.failedByLevel = [false, false, false, false, false, false, true];
      localStorage.setItem('totalScore', '1000');
      localStorage.setItem('scoredGames', '2');
      localStorage.setItem('bestScore', '500');

      component.updateStats();
      component.updateStats(); // idempotent for the same puzzle

      const stats = component.getStats();
      expect(localStorage.getItem('totalScore')).toBe('1600'); // + 600
      expect(stats.averageScore).toBe(533); // 1600 / 3
      expect(stats.bestScore).toBe(600);
      expect(stats.totalGames).toBe('1');
    });

    it('resets score stats left over from an older, larger point scale', () => {
      localStorage.setItem('totalScore', '2360');
      localStorage.setItem('scoredGames', '2');
      localStorage.setItem('bestScore', '1180');
      localStorage.setItem('streak', '3');

      component.resetStaleScoreStats();

      const stats = component.getStats();
      expect(stats.averageScore).toBe(0);
      expect(stats.bestScore).toBe(0);
      expect(localStorage.getItem('scoredGames')).toBeNull();
      expect(localStorage.getItem('streak')).toBe('3'); // other stats untouched
    });

    it("re-counts today's already-recorded game after a reset", () => {
      component.daysSinceEpoch = () => component.PUZZLE_FIRST_DAY; // puzzle #1
      component.practiceMode = false;
      component.currentLevel = component.NUM_LEVELS;
      component.incorrectGuessesByLevel = [0, 0, 0, 0, 0, 1, 0];
      component.failedByLevel = [false, false, false, false, false, false, false];
      component.hasWon = true;
      localStorage.setItem('streakLastPuzzle', '1');
      localStorage.setItem('totalScore', '2360');
      localStorage.setItem('scoredGames', '2');
      localStorage.setItem('bestScore', '1180');

      component.resetStaleScoreStats();

      const stats = component.getStats();
      expect(stats.averageScore).toBe(680);
      expect(stats.bestScore).toBe(680);
      expect(localStorage.getItem('scoredGames')).toBe('1');
    });

    it('keeps score stats that fit the current scale', () => {
      localStorage.setItem('totalScore', '1200');
      localStorage.setItem('scoredGames', '2');
      localStorage.setItem('bestScore', '700');

      component.resetStaleScoreStats();

      expect(component.getStats().averageScore).toBe(600);
      expect(component.getStats().bestScore).toBe(700);
    });

    it('reports zero average before any scored game', () => {
      expect(component.getStats().averageScore).toBe(0);
      expect(component.getStats().bestScore).toBe(0);
    });
  });

  describe('daily rank', () => {
    const URL = 'https://stats.example/';
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      environment.statsApiUrl = URL;
      fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({ total: 3482, topPercent: 12 }),
      }));
      vi.stubGlobal('fetch', fetchMock);
      component.daysSinceEpoch = () => 20700;
    });

    afterEach(() => {
      environment.statsApiUrl = '';
      vi.unstubAllGlobals();
    });

    it('submits the score once, then only reads on later calls', async () => {
      await component.fetchDailyRank();
      await component.fetchDailyRank();

      const puzzle = component.getPuzzleNumber();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        method: 'POST',
        body: JSON.stringify({ puzzle, score: component.score }),
      });
      expect(fetchMock.mock.calls[1][0]).toBe(
        `${URL}?puzzle=${puzzle}&score=${component.score}`
      );
      expect(component.dailyRank).toEqual({ total: 3482, topPercent: 12 });
    });

    it('retries the submit after a failed request', async () => {
      fetchMock.mockRejectedValueOnce(new Error('offline'));
      await component.fetchDailyRank();
      expect(component.dailyRank).toBeNull();

      await component.fetchDailyRank();
      expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST' });
    });

    it('never calls the backend in practice mode or without a URL', async () => {
      component.practiceMode = true;
      await component.fetchDailyRank();
      component.practiceMode = false;
      environment.statsApiUrl = '';
      await component.fetchDailyRank();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
