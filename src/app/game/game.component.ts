import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  Renderer2,
  inject,
} from '@angular/core';
import { mondayClues } from '../clues/monday';
import { tuesdayClues } from '../clues/tuesday';
import { wednesdayClues } from '../clues/wednesday';
import { thursdayClues } from '../clues/thursday';
import { fridayClues } from '../clues/friday';
import { saturdayClues } from '../clues/saturday';
import { sundayClues } from '../clues/sunday';
import { dailyChains, ChainLevel } from '../clues/chains';
import * as confetti from 'canvas-confetti';
import moment from 'moment-timezone';

export interface IClue {
  clueNumber: number;
  clue: string;
  answer: string;
}

export interface ILetter {
  letter: string;
  state: 'default' | 'correct' | 'absent' | 'present';
  locked?: boolean; //true for the carried green "given" letter
}

//one page of the postgame replay: a level's clue and the guesses made on it
export interface LevelReplay {
  dayName: string;
  clueNumber: number;
  clue: string;
  answer: string;
  solved: boolean;
  guesses: ILetter[][];
}

const DAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

@Component({
  standalone: false,
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit, AfterViewInit {
  private renderer2 = inject(Renderer2);
  private elementRef = inject(ElementRef);

  //Clue/chain variables
  clue: IClue = {
    clueNumber: 0,
    clue: '',
    answer: '',
  };
  cluesArray = [
    mondayClues,
    tuesdayClues,
    wednesdayClues,
    thursdayClues,
    fridayClues,
    saturdayClues,
    sundayClues,
  ];
  chain: ChainLevel[] = []; //today's 7-level chain
  answer: string = ''; //current level's answer
  givenPos: number = -1; //column of the carried green letter (-1 on Monday)
  givenLetter: string = ''; //the carried green letter itself
  private clueByAnswer: Map<string, IClue>[] = []; //per-weekday answer -> clue

  //Game state variables
  currentLevel: number = 0;
  currentDisplayLevel: number = 0; //lags currentLevel so the progress bar can transition
  incorrectGuesses: number = 0; //running total across all levels (for stats)
  incorrectGuessesByLevel: number[] = [0, 0, 0, 0, 0, 0, 0];
  //every submitted guess per level (incl. the solving guess), for the postgame replay
  guessHistoryByLevel: ILetter[][][] = [[], [], [], [], [], [], []];
  //true for any level whose guess pool ran out and whose answer was revealed
  failedByLevel: boolean[] = [false, false, false, false, false, false, false];
  hasWon: boolean = false; //true once all 7 levels are completed (game is over)
  guessNotAllowed: boolean = false; //disables input during transitions / end states
  practiceMode: boolean = false; //set true for debugging / free play
  currentDay: number = 0; //days since epoch

  //Board / entry variables
  board: ILetter[][] = []; //GUESSES_PER_LEVEL rows x WORD_LENGTH cols, fresh each level
  currentRow: number = 0; //active guess row
  currentCol: number = 0; //active cell within the row
  presentLetters: string[] = []; //keyboard highlighting
  absentLetters: string[] = [];
  correctLetters: string[] = [];

  //Transition variables
  slideOffset: number = 0; //rows to translate the board up during a level pass
  solvedRow: number = -1; //the row that was just solved (kept visible at top)
  fadeNonCarry: boolean = false; //fades every solved-row letter except the carry
  fadeKeepPos: number = -1; //column of the letter carried out to the next level
  animateGiven: boolean = false; //pops the level-1 freebie in shortly after load
  boardTransition: boolean = true; //false = snap (no animation) when swapping levels
  revealRow: number = -1; //row currently playing the staggered flip reveal

  //Toast variables
  showToast: boolean = false;
  initialHideToast: boolean = true;
  toastText: string = '';
  invalidReason: string = '';
  toastTimeout: ReturnType<typeof setTimeout>;

  //Modal variables
  showResetModal: boolean = false;
  showGameOverModal: boolean = false;
  showHelpModal: boolean = false;
  showSettingsModal: boolean = false;
  showAboutModal: boolean = false;
  showWelcomeModal: boolean = false;

  //Animation variables
  shakeChecks: boolean = false;
  invalidGuessAnimation: boolean = false;

  //Responsive board sizing (recomputed to fit between the clue and keyboard)
  tileSize: number = 49; //px per square
  rowHeight: number = 54; //tile + row margin; drives the slide-up distance
  ROW_MARGIN_PX: number = 5;

  //Constants
  WORD_LENGTH: number = 5;
  GUESSES_PER_LEVEL: number = 5; //fresh wrong-guess pool per level; no game-over
  NUM_LEVELS: number = 7;
  MAX_TILE_PX: number = 56;
  MIN_TILE_PX: number = 28;
  DEFAULT_TOAST_DURATION: number = 1500;
  PUZZLE_FIRST_DAY: number = 20609;
  FLIP_DURATION_MS: number = 500; //one tile's flip, mirrored in square.component.scss
  FLIP_STAGGER_MS: number = 250; //delay between consecutive tile flips

  //a "win" is now a flawless run: every level solved, none revealed by the game
  get flawless(): boolean {
    return !this.failedByLevel.some(Boolean);
  }

  ngOnInit(): void {
    this.setTheme();

    this.buildClueMaps();
    this.setChain();

    this.currentDay = this.daysSinceEpoch();

    let resumed = false;
    if (!this.isNewDay() && !this.practiceMode) {
      resumed = this.loadFromLocalStorage();
    }
    if (this.isNewDay()) this.resetLocalStorage();

    if (!resumed) {
      this.loadLevel(this.currentLevel);
    }

    //resuming an already-completed game: go straight to the postgame modal
    if (this.hasWon) {
      this.guessNotAllowed = true;
      this.showGameOverModal = true;
    }

    //first-ever visit: auto-show the quick beginner tutorial (skipped in practice mode)
    if (!this.practiceMode && !localStorage.getItem('hasSeenWelcome')) {
      this.showWelcomeModal = true;
    }
  }

  ngAfterViewInit(): void {
    //defer a tick so the clue/keyboard are laid out and a fresh change-detection
    //cycle flushes the computed tile size to the board
    setTimeout(() => this.setBoardSize());
  }

  @HostListener('window:resize')
  onResize() {
    this.setBoardSize();
  }

  //sizes the tiles so a full level board (GUESSES_PER_LEVEL rows) fits
  //between the clue and the keyboard
  setBoardSize() {
    const clue = document.querySelector('.clue');
    const keyboard = document.querySelector('.keyboard-container');
    const gap = 14;

    let availHeight: number;
    if (clue && keyboard) {
      availHeight =
        keyboard.getBoundingClientRect().top -
        clue.getBoundingClientRect().bottom -
        gap;
    } else {
      availHeight = window.innerHeight - 340;
    }

    const byHeight =
      Math.floor(availHeight / this.GUESSES_PER_LEVEL) - this.ROW_MARGIN_PX;
    const availWidth = Math.min(window.innerWidth, 480) - 16;
    const byWidth = Math.floor(availWidth / this.WORD_LENGTH) - 2;

    this.tileSize = Math.max(
      this.MIN_TILE_PX,
      Math.min(this.MAX_TILE_PX, byHeight, byWidth)
    );
    this.rowHeight = this.tileSize + this.ROW_MARGIN_PX;
  }

  reset() {
    this.presentLetters = [];
    this.absentLetters = [];
    this.correctLetters = [];
    this.incorrectGuessesByLevel = [0, 0, 0, 0, 0, 0, 0];
    this.failedByLevel = [false, false, false, false, false, false, false];
    this.guessHistoryByLevel = [[], [], [], [], [], [], []];
    this.currentLevel = this.currentDisplayLevel = this.incorrectGuesses = 0;
    this.slideOffset = 0;
    this.solvedRow = -1;
    this.fadeNonCarry = false;
    this.boardTransition = true;
    this.showResetModal = this.showGameOverModal = false;
    this.guessNotAllowed = false;
    this.hasWon = false;
    this.setChain();
    this.loadLevel(0);
  }

  /*------------------------------Chain / clue setup-------------------------------------*/

  //builds the per-weekday answer -> clue lookup (first occurrence wins)
  buildClueMaps() {
    this.clueByAnswer = this.cluesArray.map((clueSet) => {
      const map = new Map<string, IClue>();
      for (const [num, clue, answer] of clueSet as string[][]) {
        if (!map.has(answer)) {
          map.set(answer, { clueNumber: +num, clue, answer });
        }
      }
      return map;
    });
  }

  setChain() {
    if (this.practiceMode) {
      this.chain = dailyChains[this.getRandomInt(dailyChains.length)];
    } else {
      const index = (this.getPuzzleNumber() - 1) % dailyChains.length;
      this.chain = dailyChains[index];
    }
  }

  //resolves the clue for a level and prepares a fresh board for it
  loadLevel(level: number) {
    const [answer, carryPos] = this.chain[level];
    this.answer = answer;
    this.givenPos = carryPos;
    this.givenLetter = carryPos >= 0 ? answer[carryPos] : '';
    this.clue =
      this.clueByAnswer[level].get(answer) ??
      ({ clueNumber: 0, clue: '', answer } as IClue);

    //each level is a new word, so reset keyboard highlights; the carried letter
    //is a known-correct given, so seed it as such
    this.correctLetters = [];
    this.presentLetters = [];
    this.absentLetters = [];
    if (this.givenLetter) this.correctLetters.push(this.givenLetter);

    this.slideOffset = 0;
    this.solvedRow = -1;
    this.fadeNonCarry = false;
    //levels 2-7 carry their given in via the inter-level fade; level 1 has no
    //predecessor, so its freebie pops in on a short delay instead
    this.animateGiven = level === 0;
    this.buildBoard();
    this.currentRow = 0;
    this.prefillRow(0);
    this.currentCol = this.firstEditableCol();
    this.currentDisplayLevel = level;
  }

  //each level gets a fresh board with its own pool of GUESSES_PER_LEVEL rows
  private buildBoard() {
    this.board = [];
    const rows = this.GUESSES_PER_LEVEL;
    for (let r = 0; r < rows; r++) {
      const row: ILetter[] = [];
      for (let c = 0; c < this.answer.length; c++) {
        row.push({ letter: '', state: 'default' });
      }
      this.board.push(row);
    }
  }

  //drops the carried green letter into a row as a locked given
  private prefillRow(row: number) {
    if (this.givenPos >= 0 && this.board[row]) {
      this.board[row][this.givenPos] = {
        letter: this.givenLetter,
        state: 'correct',
        locked: true,
      };
    }
  }

  private firstEditableCol(): number {
    const row = this.board[this.currentRow];
    if (!row) return 0;
    for (let c = 0; c < row.length; c++) {
      if (!row[c].locked) return c;
    }
    return 0;
  }

  private nextEditableCol(from: number): number {
    for (let c = from + 1; c < this.answer.length; c++) {
      if (!this.board[this.currentRow][c].locked) return c;
    }
    return -1;
  }

  private prevEditableCol(from: number): number {
    for (let c = from - 1; c >= 0; c--) {
      if (!this.board[this.currentRow][c].locked) return c;
    }
    return -1;
  }

  /*------------------------------Board helpers (template)-------------------------------------*/

  //the active cell that shows the cursor highlight
  isHighlighted(row: number, col: number): boolean {
    return (
      !this.guessNotAllowed &&
      !this.hasWon &&
      this.solvedRow === -1 &&
      row === this.currentRow &&
      col === this.currentCol
    );
  }

  //fade everything in the solved row except the letter being carried forward
  isFading(row: number, col: number): boolean {
    return this.fadeNonCarry && row === this.solvedRow && col !== this.fadeKeepPos;
  }

  //the level-1 freebie square that pops in shortly after the board loads
  isGivenReveal(row: number, col: number): boolean {
    return this.animateGiven && row === 0 && col === this.givenPos;
  }

  //true for tiles in the row playing the Wordle-style staggered flip reveal;
  //the pre-filled given is already known-correct, so it sits the reveal out
  isRevealing(row: number, col: number): boolean {
    return this.revealRow === row && col !== this.givenPos;
  }

  //per-column flip delay so tiles reveal one after another, left to right;
  //columns past the skipped given shift back a step so there's no gap
  revealDelay(col: number): string {
    const index = this.givenPos >= 0 && col > this.givenPos ? col - 1 : col;
    return index * this.FLIP_STAGGER_MS + 'ms';
  }

  setCell(row: number, col: number) {
    if (this.guessNotAllowed || this.hasWon) return;
    if (row !== this.currentRow) return;
    if (this.board[row][col].locked) return;
    this.currentCol = col;
  }

  /*------------------------------Answer checking-------------------------------------*/

  //returns false if any square in the active row is empty
  isAnswerValid() {
    let valid = true;
    this.board[this.currentRow].forEach((cell) => {
      if (cell.letter === '') {
        valid = false;
        this.invalidReason = 'Not enough letters';
      }
    });
    return valid;
  }

  checkAnswer() {
    if (!this.isAnswerValid()) {
      this.invalidGuessAnimation = true;
      this.toast(this.invalidReason);
      setTimeout(() => {
        this.invalidGuessAnimation = false;
      }, 700);
      return;
    }

    if (this.guessNotAllowed) return;

    const row = this.board[this.currentRow];
    const letters = Array.from(this.answer);
    const remaining = letters.concat([]); //track remaining letters for present logic
    let correctCount = 0;

    letters.forEach((letter, i) => {
      if (letter === row[i].letter) {
        row[i].state = 'correct';
        correctCount++;
        const index = remaining.indexOf(letter);
        if (index !== -1) remaining.splice(index, 1);
        if (!this.correctLetters.includes(letter)) this.correctLetters.push(letter);
      }
    });

    letters.forEach((letter, i) => {
      if (row[i].state !== 'correct') {
        if (letters.includes(row[i].letter) && remaining.includes(row[i].letter)) {
          row[i].state = 'present';
          const index = remaining.indexOf(row[i].letter);
          if (index !== -1) remaining.splice(index, 1);
          if (!this.presentLetters.includes(row[i].letter))
            this.presentLetters.push(row[i].letter);
        } else {
          row[i].state = 'absent';
          if (!this.absentLetters.includes(row[i].letter))
            this.absentLetters.push(row[i].letter);
        }
      }
    });

    //snapshot the graded guess for the postgame replay (currentLevel is still
    //the level just guessed; handleCorrect advances it)
    this.guessHistoryByLevel[this.currentLevel].push(
      row.map((cell) => ({ ...cell }))
    );

    const solved = correctCount === this.answer.length;

    //play the staggered flip reveal, then act on the result once it finishes
    this.guessNotAllowed = true;
    this.revealRow = this.currentRow;
    //one fewer tile flips when a given is skipped, so the row finishes sooner
    const flipCount =
      this.givenPos >= 0 ? this.answer.length - 1 : this.answer.length;
    const revealTime =
      (flipCount - 1) * this.FLIP_STAGGER_MS + this.FLIP_DURATION_MS;
    setTimeout(() => {
      this.revealRow = -1;
      if (solved) {
        this.handleCorrect();
      } else {
        this.handleIncorrect();
      }
    }, revealTime);
  }

  private handleCorrect() {
    this.guessNotAllowed = true;
    this.solvedRow = this.currentRow;
    this.currentLevel++;
    this.updateLocalStorage();

    if (this.currentLevel === this.NUM_LEVELS) {
      this.currentDisplayLevel = this.NUM_LEVELS;
      this.handleComplete();
      return;
    }

    //the letter carried into the next level stays; everything else fades
    this.fadeKeepPos = this.chain[this.currentLevel]?.[1] ?? -1;

    this.renderConfetti();

    //slide the board up so the solved row rises to the top, then fade away
    //everything but the carried letter, then load the next level in its place
    setTimeout(() => {
      this.slideOffset = this.solvedRow;
      this.fadeNonCarry = true;
    }, 650);

    setTimeout(() => {
      //snap the board back to offset 0 with the new level in place (no reverse
      //slide), then re-enable transitions for the next level pass
      this.boardTransition = false;
      this.loadLevel(this.currentLevel);
      this.updateLocalStorage();
      this.guessNotAllowed = false;
      //re-enable transitions only after the snapped frame has painted, so the
      //new level doesn't slide back down
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (this.boardTransition = true))
      );
    }, 650 + 700);
  }

  private handleIncorrect() {
    this.incorrectGuesses++;
    this.incorrectGuessesByLevel[this.currentLevel]++;
    this.shakeChecks = true;
    setTimeout(() => {
      this.shakeChecks = false;
    }, 300);

    this.currentRow++;
    //out of rows for this level: reveal the answer and move on (no game-over)
    if (this.currentRow >= this.GUESSES_PER_LEVEL) {
      this.handleLevelFailed();
    } else {
      this.prefillRow(this.currentRow);
      this.currentCol = this.firstEditableCol();
      this.guessNotAllowed = false; //re-enable input after the flip reveal
      this.updateLocalStorage();
    }
  }

  //the level's guess pool ran out: flag it, show the answer, then advance.
  //persistence is deferred until the next level (or completion) is in place, so
  //reloading mid-reveal resumes cleanly on the level just played rather than
  //stranding the old board under the next level's clue.
  private handleLevelFailed() {
    this.failedByLevel[this.currentLevel] = true;
    this.guessNotAllowed = true;
    const revealDuration = 2250;
    this.toast(this.answer, revealDuration);

    this.currentLevel++;

    if (this.currentLevel === this.NUM_LEVELS) {
      this.currentDisplayLevel = this.NUM_LEVELS;
      setTimeout(() => this.handleComplete(), revealDuration + 250);
      return;
    }

    //after the answer has been shown, snap the next level's board into place
    setTimeout(() => {
      this.boardTransition = false;
      this.loadLevel(this.currentLevel);
      this.updateLocalStorage();
      this.guessNotAllowed = false;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (this.boardTransition = true))
      );
    }, revealDuration + 250);
  }

  //all 7 levels done (solved or revealed); a flawless run is the "win"
  handleComplete() {
    this.guessNotAllowed = true;
    this.hasWon = true;
    this.updateLocalStorage();
    this.updateStats();
    if (this.flawless) {
      this.renderWinConfetti();
      setTimeout(() => {
        this.showGameOverModal = true;
        this.guessNotAllowed = false;
      }, 3500);
    } else {
      setTimeout(() => {
        this.showGameOverModal = true;
        this.guessNotAllowed = false;
      }, 800);
    }
  }

  togglePracticeMode() {
    this.practiceMode = !this.practiceMode;
    this.reset();
    this.ngOnInit();
  }

  onMenuClick(selection: string) {
    if (selection === 'settings') this.toggleSettingsModal();
    if (selection === 'about') this.toggleAboutModal();
    if (selection === 'welcome') this.toggleWelcomeModal();
    if (selection === 'practice') this.togglePracticeMode();
    if (selection === 'restart') this.reset();
  }

  /*------------------------------Keyboard/letter entry-------------------------------------*/

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (!this.guessNotAllowed && !this.hasWon) {
      if (this.isLetterKey(event)) {
        this.handleLetterEntry(event.key.toUpperCase());
      }
      if (event.key === 'Backspace') this.handleDeleteLetter();
      if (event.key === 'Enter') this.checkAnswer();
      if (event.key === 'ArrowLeft') {
        const prev = this.prevEditableCol(this.currentCol);
        if (prev !== -1) this.currentCol = prev;
      }
      if (event.key === 'ArrowRight') {
        const next = this.nextEditableCol(this.currentCol);
        if (next !== -1) this.currentCol = next;
      }
    }
  }

  handleLetterEntry(letter: string) {
    if (this.board[this.currentRow][this.currentCol].locked) return;
    this.board[this.currentRow][this.currentCol].letter = letter;
    const next = this.nextEditableCol(this.currentCol);
    if (next !== -1) this.currentCol = next; //advance, stop at last editable cell
  }

  handleVirtualKeypress(event: string) {
    if (event === 'CHECK') {
      this.checkAnswer();
    } else if (event === 'BKSP') {
      this.handleDeleteLetter();
    } else {
      this.handleLetterEntry(event);
    }
  }

  handleDeleteLetter() {
    const cell = this.board[this.currentRow][this.currentCol];
    if (!cell.locked && cell.letter !== '') {
      cell.letter = '';
    } else {
      const prev = this.prevEditableCol(this.currentCol);
      if (prev !== -1) {
        this.currentCol = prev;
        this.board[this.currentRow][prev].letter = '';
      }
    }
  }

  /*------------------------------Sharing-------------------------------------*/

  getPuzzleNumber() {
    return this.daysSinceEpoch() - this.PUZZLE_FIRST_DAY + 1;
  }

  share() {
    let shareString = 'Crawsword ';
    if (!this.practiceMode) {
      shareString += '#' + this.getPuzzleNumber();
    } else {
      shareString += '(practice)';
    }

    //completion is guaranteed, so the score is how many levels were solved
    //unaided; a flawless run (none revealed) earns the trophy
    const solved = this.NUM_LEVELS - this.failedByLevel.filter(Boolean).length;
    shareString += '  ' + solved + '/' + this.NUM_LEVELS;
    if (this.flawless) shareString += ' 🏆';
    shareString += '\n\n';

    for (let i = 0; i < this.NUM_LEVELS; i++) {
      if (this.failedByLevel[i]) {
        shareString += '🟥';
      } else {
        shareString += '🟩';
        shareString += '❌'.repeat(this.incorrectGuessesByLevel[i]);
      }
      if (i !== this.NUM_LEVELS - 1) shareString += '\n';
    }

    if (navigator.share) {
      navigator.share({ text: shareString });
    } else {
      this.toast('Copied to clipboard');
      navigator.clipboard.writeText(shareString);
    }
  }

  //one replay page per level, in chain order; levels the player never reached
  //have no graded guesses and simply show their clue and answer
  getReplays(): LevelReplay[] {
    const replays: LevelReplay[] = [];
    for (let level = 0; level < this.NUM_LEVELS; level++) {
      const guesses = this.guessHistoryByLevel[level] ?? [];

      const answer = this.chain[level][0];
      const clue = this.clueByAnswer[level].get(answer);
      const solved = guesses.some((g) => g.every((cell) => cell.state === 'correct'));

      replays.push({
        dayName: DAY_NAMES[level],
        clueNumber: clue?.clueNumber ?? 0,
        clue: clue?.clue ?? '',
        answer,
        solved,
        guesses,
      });
    }
    return replays;
  }

  /*------------------------------Local Storage Helpers-------------------------------------*/

  updateLocalStorage() {
    if (!this.practiceMode) {
      localStorage.setItem('v3:incorrectGuesses', '' + this.incorrectGuesses);
      localStorage.setItem(
        'v3:incorrectGuessesByLevel',
        JSON.stringify(this.incorrectGuessesByLevel)
      );
      localStorage.setItem(
        'v3:guessHistory',
        JSON.stringify(this.guessHistoryByLevel)
      );
      localStorage.setItem(
        'v3:failedByLevel',
        JSON.stringify(this.failedByLevel)
      );
      localStorage.setItem('v3:currentDay', '' + this.daysSinceEpoch());
      localStorage.setItem('v3:currentLevel', '' + this.currentLevel);
      localStorage.setItem('v3:currentRow', '' + this.currentRow);
      localStorage.setItem('v3:board', JSON.stringify(this.board));
      localStorage.setItem('v3:hasWon', '' + this.hasWon);
    }
  }

  getStats() {
    const streak = this.getStreak();

    let tG = localStorage.getItem('totalGamesPlayed');
    if (!tG) tG = '0';

    let tW = localStorage.getItem('totalWins');
    if (!tW) tW = '0';

    let winPercent = 0;
    if (tG !== '0') winPercent = Math.round((+tW / +tG) * 100);

    let mS = localStorage.getItem('maxStreak');
    if (!mS) mS = '0';

    return {
      maxStreak: mS,
      totalGames: tG,
      winPercent: winPercent,
      currentStreak: streak,
    };
  }

  updateStats() {
    let streakLastPuzzle = localStorage.getItem('streakLastPuzzle');
    if (!streakLastPuzzle) streakLastPuzzle = '-1';

    if (+streakLastPuzzle !== this.getPuzzleNumber()) {
      if (!this.practiceMode) {
        const tG = localStorage.getItem('totalGamesPlayed');
        if (tG) {
          const tG_num = +tG;
          localStorage.setItem('totalGamesPlayed', tG_num + 1 + '');
        } else {
          localStorage.setItem('totalGamesPlayed', '1');
        }

        //a "win" is a flawless run (no revealed levels)
        const totalWins = +(localStorage.getItem('totalWins') || '0');
        localStorage.setItem(
          'totalWins',
          '' + (totalWins + (this.flawless ? 1 : 0))
        );

        //levels solved unaided this game (completion is always all 7)
        const solvedLevels =
          this.NUM_LEVELS - this.failedByLevel.filter(Boolean).length;
        const tL = localStorage.getItem('totalLevels');
        if (tL) {
          const tL_num = +tL;
          localStorage.setItem('totalLevels', tL_num + solvedLevels + '');
        } else {
          localStorage.setItem('totalLevels', solvedLevels + '');
        }

        const totalGuesses = +(localStorage.getItem('totalGuesses') || '0');
        localStorage.setItem(
          'totalGuesses',
          '' + (totalGuesses + this.incorrectGuesses)
        );

        const streak = localStorage.getItem('streak');
        const streakLastPuzzle = localStorage.getItem('streakLastPuzzle');
        let isStreakValid = true;
        if (streakLastPuzzle) {
          if (this.getPuzzleNumber() - +streakLastPuzzle > 1)
            isStreakValid = false;
        }
        //the streak counts consecutive flawless days; any revealed level ends it
        if (streak && isStreakValid) {
          let streak_num = +streak;
          if (this.flawless) streak_num++;
          else streak_num = 0;
          const mS = localStorage.getItem('maxStreak');
          let mS_num = 0;
          if (mS) mS_num = +mS;
          if (streak_num > mS_num)
            localStorage.setItem('maxStreak', '' + streak_num);
          localStorage.setItem('streak', streak_num + '');
        } else {
          let streak_num = 0;
          if (this.flawless) streak_num = 1;
          const mS = localStorage.getItem('maxStreak');
          let mS_num = 0;
          if (mS) mS_num = +mS;
          if (streak_num > mS_num)
            localStorage.setItem('maxStreak', '' + streak_num);
          localStorage.setItem('streak', streak_num + '');
        }
        localStorage.setItem('streakLastPuzzle', '' + this.getPuzzleNumber());
      }
    }
  }

  getStreak() {
    const streak = localStorage.getItem('streak');
    if (streak) return streak;
    return '0';
  }

  resetLocalStorage() {
    localStorage.removeItem('v3:incorrectGuesses');
    localStorage.removeItem('v3:incorrectGuessesByLevel');
    localStorage.removeItem('v3:guessHistory');
    localStorage.removeItem('v3:failedByLevel');
    localStorage.setItem('v3:currentDay', '' + this.daysSinceEpoch());
    localStorage.removeItem('v3:currentLevel');
    localStorage.removeItem('v3:currentRow');
    localStorage.removeItem('v3:board');
    localStorage.removeItem('v3:hasWon');
    localStorage.removeItem('v3:hasLost');
  }

  //returns true if a saved in-progress board was restored
  loadFromLocalStorage(): boolean {
    const cL = localStorage.getItem('v3:currentLevel');
    if (cL) {
      this.currentLevel = +cL;
      this.currentDisplayLevel = this.currentLevel;
    }

    const iG = localStorage.getItem('v3:incorrectGuesses');
    if (iG) this.incorrectGuesses = +iG;

    const iGBL = localStorage.getItem('v3:incorrectGuessesByLevel');
    if (iGBL) this.incorrectGuessesByLevel = JSON.parse(iGBL);

    const gH = localStorage.getItem('v3:guessHistory');
    if (gH) this.guessHistoryByLevel = JSON.parse(gH);

    const fBL = localStorage.getItem('v3:failedByLevel');
    if (fBL) this.failedByLevel = JSON.parse(fBL);

    const hW = localStorage.getItem('v3:hasWon');
    if (hW) this.hasWon = hW === 'true';

    //prime the level (clue, given letter, fresh board), then overlay saved board.
    //after a win currentLevel === NUM_LEVELS (past the last chain entry), so prime
    //the final solved level instead and keep the won display level for the progress bar
    const primeLevel = this.hasWon
      ? this.NUM_LEVELS - 1
      : this.currentLevel;
    this.loadLevel(primeLevel);
    if (this.hasWon) this.currentDisplayLevel = this.NUM_LEVELS;

    const savedBoard = localStorage.getItem('v3:board');
    if (savedBoard) {
      this.board = JSON.parse(savedBoard);
      const cR = localStorage.getItem('v3:currentRow');
      this.currentRow = cR ? +cR : 0;
      if (!this.hasWon) {
        this.currentCol = this.firstEditableCol();
      }
      this.setKeyboardFromBoard();
      return true;
    }
    return false;
  }

  //rebuilds keyboard highlight state from the restored board
  setKeyboardFromBoard() {
    this.board.forEach((row) => {
      row.forEach((cell) => {
        if (!cell.letter) return;
        if (cell.state === 'correct' && !this.correctLetters.includes(cell.letter))
          this.correctLetters.push(cell.letter);
        if (
          cell.state === 'absent' &&
          !this.absentLetters.includes(cell.letter) &&
          !this.correctLetters.includes(cell.letter)
        )
          this.absentLetters.push(cell.letter);
        if (
          cell.state === 'present' &&
          !this.presentLetters.includes(cell.letter) &&
          !this.correctLetters.includes(cell.letter)
        )
          this.presentLetters.push(cell.letter);
      });
    });
  }

  /*------------------------------Modal Helpers-------------------------------------*/

  toggleHelpModal() {
    this.showHelpModal = !this.showHelpModal;
  }

  toggleResetModal() {
    this.showResetModal = !this.showResetModal;
  }

  toggleSettingsModal() {
    this.showSettingsModal = !this.showSettingsModal;
  }

  toggleAboutModal() {
    this.showAboutModal = !this.showAboutModal;
  }

  toggleWelcomeModal() {
    this.showWelcomeModal = !this.showWelcomeModal;
    //once seen, never auto-show again (menu can still reopen it)
    localStorage.setItem('hasSeenWelcome', 'true');
  }

  /*------------------------------Other Helpers-------------------------------------*/

  setTheme() {
    const storedTheme =
      localStorage.getItem('theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light');
    if (storedTheme)
      document.documentElement.setAttribute('data-theme', storedTheme);

    const storedContrastTheme = localStorage.getItem('contrast-theme') || '';
    if (storedTheme)
      document.documentElement.setAttribute(
        'data-contrast-theme',
        storedContrastTheme
      );
  }

  isNewDay() {
    const savedDay = localStorage.getItem('v3:currentDay');
    if (savedDay && +savedDay < this.daysSinceEpoch()) {
      return true;
    } else return false;
  }

  isLetterKey(e: KeyboardEvent) {
    return /^[a-z]$/i.test(e.key);
  }

  getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
  }

  daysSinceEpoch(): number {
    const pacificTime = moment().tz('America/Los_Angeles');
    const pacificEpoch = moment.tz('1970-01-01', 'America/Los_Angeles');

    return pacificTime.diff(pacificEpoch, 'days');
  }

  getSecondsUntilTomorrow() {
    const now = new Date();
    const SECONDS = 86400 - (Math.floor(now.getTime() / 1000) % 86400) + 25200;

    return new Date(SECONDS * 1000).toISOString().substring(11, 19);
  }

  toast(text: string, duration?: number) {
    const toastDuration = duration || this.DEFAULT_TOAST_DURATION;
    window.clearTimeout(this.toastTimeout);
    this.toastText = text;
    this.showToast = true;
    this.initialHideToast = false;
    this.toastTimeout = setTimeout(() => {
      this.showToast = false;
    }, toastDuration);
  }

  renderConfetti() {
    const canvas = this.renderer2.createElement('canvas');

    this.renderer2.appendChild(this.elementRef.nativeElement, canvas);

    const myConfetti = confetti.create(canvas, {
      resize: true,
    });

    myConfetti({
      particleCount: 150,
      ticks: 75,
      spread: 70,
      angle: 60,
      origin: { y: 0.5, x: 0 },
    });

    myConfetti({
      particleCount: 150,
      ticks: 75,
      spread: 70,
      angle: 120,
      origin: { y: 0.5, x: 1 },
    });

    this.removeCanvasAfter(canvas, 1500);
  }

  renderWinConfetti() {
    const canvas = this.renderer2.createElement('canvas');

    this.renderer2.appendChild(this.elementRef.nativeElement, canvas);

    const myConfetti = confetti.create(canvas, {
      resize: true,
    });

    myConfetti({
      particleCount: 150,
      spread: 70,
      angle: 60,
      origin: { y: 0.33, x: 0 },
    });

    myConfetti({
      particleCount: 150,
      spread: 70,
      angle: 120,
      origin: { y: 0.33, x: 1 },
    });

    setTimeout(function () {
      myConfetti({
        particleCount: 150,
        spread: 70,
        angle: 60,
        origin: { y: 0.5, x: 0 },
      });

      myConfetti({
        particleCount: 150,
        spread: 70,
        angle: 120,
        origin: { y: 0.5, x: 1 },
      });
    }, 500);

    setTimeout(function () {
      myConfetti({
        particleCount: 150,
        spread: 70,
        angle: 60,
        origin: { y: 0.66, x: 0 },
      });

      myConfetti({
        particleCount: 150,
        spread: 70,
        angle: 120,
        origin: { y: 0.66, x: 1 },
      });
    }, 1000);

    setTimeout(function () {
      myConfetti({
        particleCount: 150,
        spread: 70,
        angle: 60,
        origin: { y: 0.8, x: 0 },
      });

      myConfetti({
        particleCount: 150,
        spread: 70,
        angle: 120,
        origin: { y: 0.8, x: 1 },
      });
    }, 1500);

    this.removeCanvasAfter(canvas, 5500);
  }

  private removeCanvasAfter(canvas: HTMLCanvasElement, delay: number) {
    setTimeout(() => {
      this.renderer2.removeChild(this.elementRef.nativeElement, canvas);
    }, delay);
  }
}
