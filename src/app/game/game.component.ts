import { Component, ElementRef, HostListener, OnInit, Renderer2, inject } from '@angular/core';
import { mondayClues } from '../clues/monday';
import { tuesdayClues } from '../clues/tuesday';
import { wednesdayClues } from '../clues/wednesday';
import { thursdayClues } from '../clues/thursday';
import { fridayClues } from '../clues/friday';
import { saturdayClues } from '../clues/saturday';
import { sundayClues } from '../clues/sunday';
import seedrandom from 'seedrandom';
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
}

@Component({
  standalone: false,
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
})
export class GameComponent implements OnInit {
  private renderer2 = inject(Renderer2);
  private elementRef = inject(ElementRef);

  //Clue variables
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
  clueSeeds: number[];

  //Game state variables
  currentLevel: number = 0;
  currentDisplayLevel: number = 0; //need this to make the transition for the progress bar, it updates after the true level does
  incorrectGuesses: number = 0;
  incorrectGuessesByLevel: number[] = [0, 0, 0, 0, 0, 0, 0]; //tracks how many incorrect guesses are used per level
  hasWon: boolean = false; //true if user has won already in the daily
  hasLost: boolean = false; //true if user has lost already in the daily
  guessNotAllowed: boolean = false; //disables typing and guessing in certain cases (e.g. win, loss, waiting for confetti/fade)
  practiceMode: boolean = false; //set true for debugging
  currentDay: number = 0; //days since epoch

  //Keyboard and letter entry variables
  submissions: ILetter[][] = []; //historical log of guesses for a particular clue
  letters: string[] = []; //string of answer letters
  enteredLetters: ILetter[] = []; //currently entered letters
  presentLetters: string[] = []; //keyboard highlighting
  absentLetters: string[] = []; //keyboard highlighting
  correctLetters: string[] = []; //keyboard highlighting
  entryIndex: number = 0; //'cursor' for entering letters

  //Toast variables
  showToast: boolean = false; //used to show and hide the 'need more letters' toast
  initialHideToast: boolean = true; //used to hide boolean on initial load to prevent the fade out from happening on load
  toastText: string = '';
  invalidReason: string = ''; //reason for why a guess is invalid, shown in toast text
  toastTimeout: ReturnType<typeof setTimeout>; //used to reset toast if multiple are called in rapid succession

  //Modal variables
  showResetModal: boolean = false;
  showGameOverModal: boolean = false;
  showHelpModal: boolean = false;
  showSettingsModal: boolean = false;
  showAboutModal: boolean = false;

  //Animation variables
  shakeChecks: boolean = false; //used to shake x's when incorrect guess
  invalidGuessAnimation: boolean = false; //used to show shake animation when an invalid guess is submitted
  solved: boolean = false; //controls fade in and fade out for solved clues
  gameWindowHeight: number; //scrollable game area

  //Constants
  SCROLLABLE_AREA_OFFSET: number = 265; //pixel offset for header and keyboard to calc scrollable area
  MAX_INCORRECT_GUESSES: number = 10;
  DEFAULT_TOAST_DURATION: number = 1500; //how long the toast appears for, in milliseconds
  PUZZLE_FIRST_DAY: number = 19120;

  ngOnInit(): void {
    this.setTheme(); //set color theme e.g. dark, contrast

    this.setClueSeeds();

    this.currentDay = this.daysSinceEpoch();
    if (!this.isNewDay() && !this.practiceMode) {
      this.loadFromLocalStorage();
      this.scrollGameToBottom();
    }
    if (this.isNewDay()) this.resetLocalStorage();

    //need to handle win
    if (this.hasWon) {
      this.enteredLetters = this.submissions[this.submissions.length - 1];
      this.currentLevel = 6;
      this.currentDisplayLevel = 7;
      this.entryIndex = -1;
      this.handleWin();
    }

    this.setClue();

    //resetting loss condition depends on clue already being set so toast can show
    if (this.hasLost) {
      this.entryIndex = -1;
      this.enteredLetters = this.submissions[this.submissions.length - 1];
      this.handleLoss();
    }

    this.setScrollableArea();
  }

  reset() {
    //uncomment for debug mode V
    // this.resetLocalStorage()
    this.submissions = [];
    this.enteredLetters = [];
    this.presentLetters = [];
    this.absentLetters = [];
    this.correctLetters = [];

    this.incorrectGuessesByLevel = [0, 0, 0, 0, 0, 0, 0]; //tracks how many incorrect guesses are used per level
    this.currentLevel =
      this.currentDisplayLevel =
      this.incorrectGuesses =
      this.entryIndex =
        0;
    this.showResetModal = this.showGameOverModal = false;
    this.guessNotAllowed = false;
    this.hasWon = false;
    this.hasLost = false;
    this.setClueSeeds();
    this.setClue();
  }

  setClueSeeds() {
    this.clueSeeds = [];
    if (this.practiceMode) {
      this.cluesArray.forEach((clueSet) => {
        this.clueSeeds.push(this.getRandomInt(clueSet.length));
      });
    } else {
      //sets the daily seed if not in practice mode
      let i = 0;
      this.cluesArray.forEach((clueSet) => {
        this.clueSeeds.push(
          this.getRandomIntSeeded(clueSet.length, this.daysSinceEpoch() + i)
        );
        i++;
      });
    }
  }

  //gets state of entered letter
  getState(i: number) {
    if (i < this.enteredLetters.length) {
      return this.enteredLetters[i].state;
    } else {
      return '';
    }
  }

  //fill empty letters on board
  getLetter(i: number) {
    if (i < this.enteredLetters.length) {
      return this.enteredLetters[i].letter;
    } else {
      return '';
    }
  }

  setEntryIndex(i: number) {
    this.entryIndex = i;
  }

  setLetters(answer: string) {
    this.letters = [];
    if (!this.hasWon && !this.hasLost) this.enteredLetters = []; //don't reset this if the user has won so we can show the last answer

    Array.from(answer).forEach((letter) => {
      this.letters.push(letter);
      this.enteredLetters.push({
        //fill entered letter array with empty letters
        letter: '',
        state: 'default',
      });
    });
  }

  getNewPuzzle() {
    setTimeout(() => {
      this.absentLetters = [];
      this.presentLetters = [];
      this.correctLetters = [];
      this.submissions = [];
      this.updateLocalStorage();
      this.setClue();
      this.entryIndex = 0;
      this.solved = false;
      this.currentDisplayLevel = this.currentLevel;
      this.guessNotAllowed = false; //need to reset this from the check answer func
    }, 500);
  }

  //checks if any squares are empty and returns false if so
  isAnswerValid() {
    let validGuess = true;
    this.enteredLetters.forEach((letter) => {
      if (letter.letter === '') {
        validGuess = false;
        this.invalidReason = 'Not enough letters';
      }
    });

    // TODO: implement word dictionary checking

    // if (validGuess){
    //   let word = ""
    //   this.enteredLetters.forEach(letter => {
    //     word += letter.letter
    //   })
    //   console.log(word)
    // }

    // console.log("valid guess?")
    // console.log(validGuess)
    return validGuess;
  }

  checkAnswer() {
    let correctLetterCount = 0;

    //check if any squares are empty and if so, abort the check
    if (!this.isAnswerValid()) {
      this.invalidGuessAnimation = true;
      this.toast(this.invalidReason);
      setTimeout(() => {
        this.invalidGuessAnimation = false;
      }, 700);
      return;
    }

    if (this.guessNotAllowed) return;

    const tempLettersRemaining = this.letters.concat([]); //temp array to track remaining letters, allows greens and yellos of same letter in same guess

    this.letters.forEach((letter, i) => {
      if (letter === this.enteredLetters[i].letter) {
        this.enteredLetters[i].state = 'correct';
        correctLetterCount++;

        //remove letter from temp array
        const index = tempLettersRemaining.indexOf(letter);
        if (index !== -1) tempLettersRemaining.splice(index, 1);

        this.correctLetters.push(letter);
      }
    });

    this.letters.forEach((letter, i) => {
      if (this.enteredLetters[i].state !== 'correct') {
        if (
          this.letters.includes(this.enteredLetters[i].letter) &&
          tempLettersRemaining.includes(this.enteredLetters[i].letter)
        ) {
          this.enteredLetters[i].state = 'present';

          this.presentLetters.push(this.enteredLetters[i].letter);
          const index = tempLettersRemaining.indexOf(
            this.enteredLetters[i].letter
          );
          if (index !== -1) tempLettersRemaining.splice(index, 1);
        } else {
          this.enteredLetters[i].state = 'absent';
          this.absentLetters.push(this.enteredLetters[i].letter);
        }
      }
    });

    if (correctLetterCount === this.letters.length) {
      this.guessNotAllowed = true;
      this.currentLevel++;
      this.updateLocalStorage();
      this.entryIndex = -1; //to hide highlighter during confetti
      if (this.currentLevel === 7) {
        this.currentDisplayLevel = 7;
        this.submissions.push(this.enteredLetters);
        this.handleWin();
      } else {
        this.renderConfetti();
        setTimeout(() => {
          this.solved = true;
          this.getNewPuzzle();
        }, 750); //start the get new puzzle animation after this much time has passed. i.e. how long do they look at the confetti
      }
    } else {
      this.incorrectGuesses++;
      this.incorrectGuessesByLevel[this.currentLevel]++;
      this.updateLocalStorage();
      this.shakeChecks = true;
      setTimeout(() => {
        this.shakeChecks = false;
      }, 300);
      if (this.incorrectGuesses === this.MAX_INCORRECT_GUESSES) {
        this.guessNotAllowed = true;
        this.entryIndex = -1;
        this.submissions.push(this.enteredLetters);
        this.handleLoss();
      } else {
        this.submissions.push(this.enteredLetters);
        this.updateLocalStorage();
        this.enteredLetters = [];
        this.letters.forEach(() => {
          this.enteredLetters.push({
            letter: '',
            state: 'default',
          });
        });
        this.entryIndex = 0;

        this.scrollGameToBottom();
      }
    }
  }

  handleLoss() {
    this.hasLost = true;
    this.guessNotAllowed = true;
    this.updateLocalStorage();
    this.updateStats();
    const toastDuration = 2250;
    this.toast(this.clue.answer, toastDuration);

    setTimeout(() => {
      //wait until toast finishes to launch the modal
      this.showGameOverModal = true;
      this.guessNotAllowed = false;
    }, toastDuration + 500);
  }

  handleWin() {
    this.guessNotAllowed = true;
    this.hasWon = true;
    this.updateLocalStorage();
    this.updateStats();
    this.renderWinConfetti();
    setTimeout(() => {
      //wait until toast finishes to launch the modal
      this.showGameOverModal = true;
      this.guessNotAllowed = false;
    }, 3500); //wait until victory confetti finishes
  }

  togglePracticeMode() {
    this.practiceMode = !this.practiceMode;
    this.reset();
    this.ngOnInit();
  }

  onMenuClick(selection: string) {
    if (selection === 'settings') {
      this.toggleSettingsModal();
    }

    if (selection === 'about') {
      this.toggleAboutModal();
    }

    if (selection === 'practice') {
      this.togglePracticeMode();
    }

    if (selection === 'restart') {
      this.reset();
    }
  }

  /*------------------------------Keyboard/letter entry-------------------------------------*/

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (!this.guessNotAllowed && !this.hasWon && !this.hasLost) {
      if (this.isLetterKey(event)) {
        this.handleLetterEntry(event.key.toUpperCase());
      }
      if (event.key === 'Backspace') {
        //handle delete characters and move index on backspace
        this.handleDeleteLetter();
      }
      if (event.key === 'Enter') {
        this.checkAnswer();
      }
      if (event.key === 'ArrowLeft') {
        this.entryIndex--;
        if (this.entryIndex < 0) this.entryIndex = 0;
      }
      if (event.key === 'ArrowRight') {
        this.entryIndex++;
        if (this.entryIndex === this.enteredLetters.length)
          this.entryIndex = this.enteredLetters.length - 1;
      }
    }
  }

  handleLetterEntry(letter: string) {
    this.enteredLetters[this.entryIndex].letter = letter;

    if (this.entryIndex < this.clue.answer.length - 1) {
      this.entryIndex++;
    }
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
    let deleteIndex;
    if (this.enteredLetters[this.entryIndex].letter !== '') {
      deleteIndex = this.entryIndex;
    } else {
      deleteIndex = this.entryIndex - 1;
      this.entryIndex--;
    }

    if (deleteIndex < 0) deleteIndex = 0;
    if (this.entryIndex < 0) this.entryIndex = 0;

    this.enteredLetters[deleteIndex].letter = '';
  }

  setClue() {
    this.clue = {
      clueNumber:
        +this.cluesArray[this.currentLevel][
          this.clueSeeds[this.currentLevel]
        ][0],
      clue: this.cluesArray[this.currentLevel][
        this.clueSeeds[this.currentLevel]
      ][1],
      answer:
        this.cluesArray[this.currentLevel][
          this.clueSeeds[this.currentLevel]
        ][2],
    };
    this.setLetters(this.clue.answer);
  }

  /*------------------------------Sharing-------------------------------------*/

  //gets the 1 indexed puzzle number shoutout matlab
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

    if (this.hasWon) this.currentLevel = 7;
    shareString += ' ' + this.currentLevel + '/7';
    if (this.hasWon) shareString += '🎉';
    shareString += '\n\n';

    for (let i = 0; i < 7; i++) {
      if (i < this.currentLevel) {
        shareString += '🟩';
        shareString += '❌'.repeat(this.incorrectGuessesByLevel[i]);
      }

      if (i === this.currentLevel) {
        shareString += '🟨';
        shareString += '❌'.repeat(this.incorrectGuessesByLevel[i]);
      }

      if (i > this.currentLevel) shareString += '⬛';

      if (i !== 6) shareString += '\n'; //newline
    }

    if (navigator.share) {
      navigator.share({
        text: shareString,
      });
    } else {
      this.toast('Copied to clipboard');
      navigator.clipboard.writeText(shareString);
    }
  }

  /*------------------------------Local Storage Helpers-------------------------------------*/

  updateLocalStorage() {
    if (!this.practiceMode) {
      localStorage.setItem('incorrectGuesses', '' + this.incorrectGuesses);
      localStorage.setItem(
        'incorrectGuessesByLevel',
        JSON.stringify(this.incorrectGuessesByLevel)
      );
      localStorage.setItem('currentDay', '' + this.daysSinceEpoch());
      localStorage.setItem('currentLevel', '' + this.currentLevel);
      localStorage.setItem('currentEntries', JSON.stringify(this.submissions));
      localStorage.setItem('hasWon', '' + this.hasWon);
      localStorage.setItem('hasLost', '' + this.hasLost);
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
    //cant use isnewday() here because it updates frequently, basically checking here if the stats have been logged yet today
    let streakLastPuzzle = localStorage.getItem('streakLastPuzzle');
    if (!streakLastPuzzle) streakLastPuzzle = '-1';

    if (+streakLastPuzzle !== this.getPuzzleNumber()) {
      //if stats haven't been logged today
      if (!this.practiceMode) {
        const tG = localStorage.getItem('totalGamesPlayed');
        if (tG) {
          const tG_num = +tG;
          localStorage.setItem('totalGamesPlayed', tG_num + 1 + '');
        } else {
          localStorage.setItem('totalGamesPlayed', '1');
        }

        const totalWins = +(localStorage.getItem('totalWins') || '0');
        localStorage.setItem(
          'totalWins',
          '' + (totalWins + (this.hasWon ? 1 : 0))
        );

        const tL = localStorage.getItem('totalLevels');
        if (tL) {
          const tL_num = +tL;
          localStorage.setItem('totalLevels', tL_num + this.currentLevel + '');
        } else {
          localStorage.setItem('totalLevels', this.currentLevel + '');
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
            isStreakValid = false; //if its been longer than a day since last puzzle solve
        }
        if (streak && isStreakValid) {
          let streak_num = +streak;
          if (this.hasLost) streak_num = 0;
          if (this.hasWon) streak_num++;
          const mS = localStorage.getItem('maxStreak');
          let mS_num = 0;
          if (mS) mS_num = +mS;
          if (streak_num > mS_num)
            localStorage.setItem('maxStreak', '' + streak_num);
          localStorage.setItem('streak', streak_num + '');
        } else {
          let streak_num = 0;
          if (this.hasWon) streak_num = 1;
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
    localStorage.removeItem('incorrectGuesses');
    localStorage.removeItem('incorrectGuessesByLevel');
    localStorage.setItem('currentDay', '' + this.daysSinceEpoch());
    localStorage.removeItem('currentLevel');
    localStorage.removeItem('currentEntries');
    localStorage.removeItem('hasWon');
    localStorage.removeItem('hasLost');
  }

  loadFromLocalStorage() {
    const iG = localStorage.getItem('incorrectGuesses');
    if (iG) this.incorrectGuesses = +iG;

    const iGBL = localStorage.getItem('incorrectGuessesByLevel');
    if (iGBL) this.incorrectGuessesByLevel = JSON.parse(iGBL);

    const cL = localStorage.getItem('currentLevel');
    if (cL) {
      this.currentLevel = +cL;
      this.currentDisplayLevel = this.currentLevel;
    }

    const cE = localStorage.getItem('currentEntries');
    if (cE) {
      this.submissions = JSON.parse(cE);
      this.setKeyboardFromSubmissions();
    }

    const hW = localStorage.getItem('hasWon');
    if (hW) this.hasWon = hW === 'true';

    const hL = localStorage.getItem('hasLost');
    if (hL) this.hasLost = hL === 'true';
  }

  //sets keyboard state when loading from cookies. prevents from needing additional cookies to track keyboard
  setKeyboardFromSubmissions() {
    this.submissions.forEach((submission) => {
      submission.forEach((letter) => {
        if (
          letter.state === 'correct' &&
          !this.correctLetters.includes(letter.letter)
        )
          this.correctLetters.push(letter.letter);
        if (
          letter.state === 'absent' &&
          !this.absentLetters.includes(letter.letter) &&
          !this.correctLetters.includes(letter.letter)
        )
          this.absentLetters.push(letter.letter);
        if (
          letter.state === 'present' &&
          !this.presentLetters.includes(letter.letter) &&
          !this.correctLetters.includes(letter.letter)
        )
          this.presentLetters.push(letter.letter);
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

  /*------------------------------Other Helpers-------------------------------------*/

  @HostListener('window:resize')
  onResize() {
    this.setScrollableArea();
  }

  setScrollableArea() {
    this.gameWindowHeight = window.innerHeight - this.SCROLLABLE_AREA_OFFSET;
  }

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
    const savedDay = localStorage.getItem('currentDay');
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

  getRandomIntSeeded(max: number, seed: number) {
    const rand = seedrandom(String(seed));
    return Math.floor(rand() * max);
  }

  //used for random seeding
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

  scrollGameToBottom() {
    const el = document.getElementById('letters-row-wrapper');
    setTimeout(function () {
      el?.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth',
      });
    }, 1);
  }

  renderConfetti() {
    const canvas = this.renderer2.createElement('canvas');

    this.renderer2.appendChild(this.elementRef.nativeElement, canvas);

    const myConfetti = confetti.create(canvas, {
      resize: true, // will fit all screen sizes
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
      resize: true, // will fit all screen sizes
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
