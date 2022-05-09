import { Component, ElementRef, HostListener, OnInit, Renderer2 } from '@angular/core';
import { mondayClues } from '../clues/monday';
import { tuesdayClues } from '../clues/tuesday';
import { wednesdayClues } from '../clues/wednesday';
import { thursdayClues } from '../clues/thursday';
import { fridayClues } from '../clues/friday';
import { saturdayClues } from '../clues/saturday';
import { sundayClues } from '../clues/sunday';
import seedrandom from 'seedrandom';
import { allKeys } from '../keys';
import * as confetti from 'canvas-confetti';

export interface IClue {
  clueNumber: number;
  clue: any;
  answer: any;
}

export interface ILetter {
  letter: any;
  state: "default" | "correct" | "absent" | "present"
}

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})

export class GameComponent implements OnInit {

  //Clue variables
  clue: IClue = {
    clueNumber: 0,
    clue: "",
    answer: ""
  };
  cluesArray = [
    mondayClues,
    tuesdayClues,
    wednesdayClues,
    thursdayClues,
    fridayClues,
    saturdayClues,
    sundayClues
  ]
  clueSeeds: number[];

  //Game state variables
  currentLevel: number = 0;
  currentDisplayLevel: number = 0; //need this to make the transition for the progress bar, it updates after the true level does
  incorrectGuesses: number = 0;
  incorrectGuessesByLevel: number[] = [0, 0, 0, 0, 0, 0, 0] //tracks how many incorrect guesses are used per level
  hasWon: boolean = false; //true if user has won already in the daily
  hasLost: boolean = false; //true if user has lost already in the daily
  guessNotAllowed: boolean = false; //disables typing and guessing in certain cases (e.g. win, loss, waiting for confetti/fade)


  //Keyboard and letter entry variables
  submissions: ILetter[][] = [] //historical log of guesses for a particular clue
  letters: string[] = [] //string of answer letters
  enteredLetters: ILetter[] = [] //currently entered letters
  presentLetters: string[] = [] //keyboard highlighting
  absentLetters: string[] = [] //keyboard highlighting
  correctLetters: string[] = [] //keyboard highlighting
  entryIndex: number = 0; //'cursor' for entering letters

  //Toast variables
  showToast: boolean = false; //used to show and hide the 'need more letters' toast
  initialHideToast: boolean = true; //used to hide boolean on initial load to prevent the fade out from happening on load
  toastText: string = "";
  invalidReason: string = ""; //reason for why a guess is invalid, shown in toast text
  toastTimeout: any; //used to reset toast if multiple are called in rapid succession

  practiceMode: boolean = false; //set true for debugging
  currentDay: number = 0; //days since epoch

  //Modal variables
  showResetModal: boolean = false;
  showLossModal: boolean = false;
  showWinModal: boolean = false;
  showHelpModal: boolean = false;

  //Animation variables
  shakeChecks: boolean = false; //used to shake x's when incorrect guess
  invalidGuessAnimation: boolean = false; //used to show shake animation when an invalid guess is submitted
  solved: boolean = false; //controls fade in and fade out for solved clues
  gameWindowHeight: number; //scrollable game area

  //Constants
  SCROLLABLE_AREA_OFFSET: number = 265; //pixel offset for header and keyboard to calc scrollable area
  MAX_INCORRECT_GUESSES: number = 10;
  DEFAULT_TOAST_DURATION: number = 1500; //how long the toast appears for, in milliseconds
  PUZZLE_FIRST_DAY: number = 19120; //first day (in days since epoch) that the daily puzzle was ran

  constructor(
    private renderer2: Renderer2,
    private elementRef: ElementRef
  ){}

  ngOnInit(): void {
    this.setClueSeeds()
    
    this.currentDay = this.daysSinceEpoch()
    if (!this.isNewDay() && !this.practiceMode){
      this.loadFromLocalStorage()
      this.scrollGameToBottom()
    }
    
    //resetting win condition depends on clue not being set yet
    if (this.hasWon){
      this.currentLevel = 6
      this.currentDisplayLevel = 7
      this.entryIndex = -1;
      this.handleWin()
    }

    this.setClue()

    //resetting loss condition depends on clue already being set so toast can show
    if (this.hasLost){
      this.entryIndex = -1
      this.enteredLetters = this.submissions[this.submissions.length - 1]
      this.handleLoss()
    }

    //sets the scrollable game area
    //TODO add this to window resize listener
    this.gameWindowHeight = window.innerHeight - this.SCROLLABLE_AREA_OFFSET
  }

  reset(){
    this.resetLocalStorage()
    this.submissions = []
    this.enteredLetters = []
    this.incorrectGuessesByLevel = [0, 0, 0, 0, 0, 0, 0] //tracks how many incorrect guesses are used per level
    this.currentLevel = this.currentDisplayLevel = this.incorrectGuesses = this.entryIndex = 0;
    this.showResetModal = this.showLossModal = this.showWinModal = false;
    this.guessNotAllowed = false;
    this.hasWon = false
    this.hasLost = false
    this.setClueSeeds()
    this.setClue()
  }

  setClueSeeds(){
    this.clueSeeds = [];
    if (this.practiceMode){
      this.cluesArray.forEach(clueSet => {
        this.clueSeeds.push(this.getRandomInt(clueSet.length - 1))
      })
    } else { //sets the daily seed if not in practice mode  
      let i = 0;
      this.cluesArray.forEach(clueSet => {
        this.clueSeeds.push(this.getRandomIntSeeded(clueSet.length - 1, this.daysSinceEpoch() + i))
        i++;
      })
    }
  }

  //gets state of entered letter
  getState(i: any){
    if (i < this.enteredLetters.length){
      return this.enteredLetters[i].state
    } else {
      return ""
    }
  }

  //fill empty letters on board
  getLetter(i: any){
    if (i < this.enteredLetters.length){
      return this.enteredLetters[i].letter
    } else {
      return ""
    }
  }

  setEntryIndex(i: number){
    this.entryIndex = i;
  }

  setLetters(answer: string){
    this.letters = [];
    if (!this.hasWon && !this.hasLost) this.enteredLetters = []; //don't reset this if the user has won so we can show the last answer
    this.absentLetters = []
    this.presentLetters = []
    this.correctLetters = []

    Array.from(answer).forEach(letter => {
      this.letters.push(letter)
      if (!this.hasWon){
        this.enteredLetters.push({ //fill entered letter array with empty letters
          letter: "",
          state: "default"
        })
      } else {
        this.enteredLetters.push({
          letter: letter,
          state: "correct"
        })
      }
    })    
  }

  getNewPuzzle(){
    let that = this

    setTimeout(function(){
      that.submissions = []
      that.updateLocalStorage()
      that.setClue()
      that.entryIndex = 0;
      that.solved = false;
      that.currentDisplayLevel = that.currentLevel
      that.guessNotAllowed = false; //need to reset this from the check answer func
    }, 500);
  }

  //checks if any squares are empty and returns false if so
  isAnswerValid(){
    let validGuess = true;
    this.enteredLetters.forEach(letter => {
      if (letter.letter === "") {
        validGuess = false
        this.invalidReason = "Not enough letters"
      }
    })
    return validGuess
  }

  checkAnswer(){
    let correctLetterCount = 0;
    let that = this;

    //check if any squares are empty and if so, abort the check
    if (!this.isAnswerValid()){
      this.invalidGuessAnimation = true;
      this.toast(this.invalidReason)
      setTimeout(function(){
        that.invalidGuessAnimation = false;
      }, 700);
      return
    }    

    if (this.guessNotAllowed) return

    let tempLettersRemaining = this.letters.concat([]); //temp array to track remaining letters, allows greens and yellos of same letter in same guess

    this.letters.forEach((letter, i) => {
      if(letter === this.enteredLetters[i].letter){
        this.enteredLetters[i].state = "correct"
        correctLetterCount++

        //remove letter from temp array
        let index = tempLettersRemaining.indexOf(letter)
        if (index !== -1) tempLettersRemaining.splice(index, 1)

        this.correctLetters.push(letter)
      }  
    })

    this.letters.forEach((letter, i) => {

      if (this.enteredLetters[i].state !== "correct"){

        if (this.letters.includes(this.enteredLetters[i].letter) && tempLettersRemaining.includes(this.enteredLetters[i].letter)){
          
          this.enteredLetters[i].state = "present"

          this.presentLetters.push(this.enteredLetters[i].letter)
          let index = tempLettersRemaining.indexOf(this.enteredLetters[i].letter)
          if (index !== -1) tempLettersRemaining.splice(index, 1)

        } else {

          this.enteredLetters[i].state = "absent"
          this.absentLetters.push(this.enteredLetters[i].letter)

        }
      }
    })
    
    if (correctLetterCount === this.letters.length){
      this.guessNotAllowed = true
      this.currentLevel++
      this.updateLocalStorage()
      this.entryIndex = -1 //to hide highlighter during confetti
      if (this.currentLevel === 7){
        this.currentDisplayLevel = 7
        this.handleWin()
      } else {
        this.renderConfetti()
        setTimeout(function(){
          that.solved = true;
          that.getNewPuzzle()
        }, 750); //start the get new puzzle animation after this much time has passed. i.e. how long do they look at the confetti
      }

    } else {
      this.incorrectGuesses++
      this.incorrectGuessesByLevel[this.currentLevel]++
      this.updateLocalStorage()
      this.shakeChecks = true;
      setTimeout(function(){
        that.shakeChecks = false;
      }, 300);
      if (this.incorrectGuesses === this.MAX_INCORRECT_GUESSES){
        this.guessNotAllowed = true;
        this.entryIndex = -1
        this.submissions.push(this.enteredLetters)
        this.handleLoss()
      } else {
        this.submissions.push(this.enteredLetters)
        this.updateLocalStorage()
        this.enteredLetters = []
        this.letters.forEach(letter => {
          this.enteredLetters.push({
            letter: "",
            state: "default"
          })
        })
        this.entryIndex = 0;

        this.scrollGameToBottom()
      }
    }
  }

  handleLoss(){
    this.hasLost = true;
    this.updateLocalStorage()
    let that = this;
    let toastDuration = 2250
    this.toast(this.clue.answer, toastDuration)

    setTimeout(function(){ //wait until toast finishes to launch the modal
      that.showLossModal = true
    }, toastDuration + 500);
  }

  handleWin(){
    this.hasWon = true;
    this.updateLocalStorage()
    let that = this;
    this.renderWinConfetti()
    setTimeout(function(){ //wait until toast finishes to launch the modal
      that.showWinModal = true
    }, 3500); //wait until victory confetti finishes
  }

  toggleHelpModal(){
    this.showHelpModal = !this.showHelpModal
  }

  toggleResetModal(){
    this.showResetModal = !this.showResetModal;
  }

  onMenuClick(event: any){
    console.log(event)
  }

  /*------------------------------Keyboard/letter entry-------------------------------------*/

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if (!this.guessNotAllowed && !this.hasWon && !this.hasLost) {
      if(this.isKeyPrintable(event)){ //checks if entry is a letter or number and handles the entry
        this.handleLetterEntry(event.key.toUpperCase())
      }
      if(event.key === "Backspace"){ //handle delete characters and move index on backspace
        this.handleDeleteLetter()
      }
      if(event.key === "Enter"){
        this.checkAnswer()
      }
      if(event.key === "ArrowLeft"){
        this.entryIndex--
        if (this.entryIndex < 0 ) this.entryIndex = 0
      }
      if(event.key === "ArrowRight"){
        this.entryIndex++
        if (this.entryIndex === this.enteredLetters.length ) this.entryIndex = this.enteredLetters.length - 1
      }
    }
  }

  handleLetterEntry(letter: any){

    this.enteredLetters[this.entryIndex].letter = letter
  
    if (this.entryIndex < this.clue.answer.length - 1){
      this.entryIndex++
    }
  }

  handleVirtualKeypress(event: any){

    if (event === "CHECK"){
      this.checkAnswer()
    } else if (event === "BKSP"){
      this.handleDeleteLetter()
    } else {
      this.handleLetterEntry(event)
    }
  }

  handleDeleteLetter(){
    let deleteIndex
    if (this.enteredLetters[this.entryIndex].letter !== ""){
      deleteIndex = this.entryIndex
    } else {
      deleteIndex = this.entryIndex - 1
      this.entryIndex--
    } 
    
    if (deleteIndex < 0) deleteIndex = 0
    if (this.entryIndex < 0) this.entryIndex = 0

    this.enteredLetters[deleteIndex].letter = ""

  }

  setClue(){
    this.clue = {
      clueNumber: +this.cluesArray[this.currentLevel][this.clueSeeds[this.currentLevel]][0],
      clue: this.cluesArray[this.currentLevel][this.clueSeeds[this.currentLevel]][1],
      answer: this.cluesArray[this.currentLevel][this.clueSeeds[this.currentLevel]][2]
    }
    this.setLetters(this.clue.answer)

  }

  /*------------------------------Sharing-------------------------------------*/

  share(){
    let shareString = "Crawsword (beta) #"
    let puzzleNumber = this.daysSinceEpoch() - this.PUZZLE_FIRST_DAY + 1 //gets the 1 indexed puzzle number shoutout matlab
    
    if (this.hasWon) this.currentLevel = 7
    shareString += puzzleNumber + " " + this.currentLevel + "/7"
    if (this.hasWon) shareString += "🎉"
    shareString += "\n\n"

    for(let i = 0; i < 7; i++){
      if(i < this.currentLevel){
        shareString += "🟦"
        shareString += "❌".repeat(this.incorrectGuessesByLevel[i])
      } 

      if(i === this.currentLevel){
        shareString += "🟨"
        shareString += "❌".repeat(this.incorrectGuessesByLevel[i])
      } 

      if(i > this.currentLevel) shareString += "⬛"

      if (i !== 6) shareString += "\n"; //newline
    }

    if(navigator.share){
      navigator.share({
        text: shareString
      })
    } else {
      this.toast("Copied to clipboard")
      navigator.clipboard.writeText(shareString)
    }

  }

  /*------------------------------Local Storage Helpers-------------------------------------*/

  updateLocalStorage(){
    localStorage.setItem('incorrectGuesses', "" + this.incorrectGuesses)
    localStorage.setItem('incorrectGuessesByLevel', JSON.stringify(this.incorrectGuessesByLevel))
    localStorage.setItem('currentDay', "" + this.daysSinceEpoch())
    localStorage.setItem('currentLevel', "" + this.currentLevel)
    localStorage.setItem('currentEntries', JSON.stringify(this.submissions))
    localStorage.setItem('hasWon', "" + this.hasWon)
    localStorage.setItem('hasLost', "" + this.hasLost)
  }

  resetLocalStorage(){
    localStorage.removeItem('incorrectGuesses')
    localStorage.removeItem('incorrectGuessesByLevel')
    localStorage.removeItem('currentDay')
    localStorage.removeItem('currentLevel')
    localStorage.removeItem('currentEntries')
    localStorage.removeItem('hasWon')
    localStorage.removeItem('hasLost')
  }

  loadFromLocalStorage(){
    let iG = localStorage.getItem('incorrectGuesses')
    if (iG) this.incorrectGuesses = +iG

    let iGBL = localStorage.getItem('incorrectGuessesByLevel')
    if (iGBL) this.incorrectGuessesByLevel = JSON.parse(iGBL)

    let cL = localStorage.getItem('currentLevel')
    if (cL) {
      this.currentLevel = +cL
      this.currentDisplayLevel = this.currentLevel
    }
    
    let cE = localStorage.getItem('currentEntries')
    if (cE) this.submissions = JSON.parse(cE)

    let hW = localStorage.getItem('hasWon')
    if (hW) this.hasWon = hW === "true"

    let hL = localStorage.getItem('hasLost')
    if (hL) this.hasLost = hL === "true"
      
  }

  /*------------------------------Other Helpers-------------------------------------*/

  isNewDay(){
    let savedDay = localStorage.getItem('currentDay')
    if (savedDay && +savedDay < this.daysSinceEpoch()) {
      return true
    } else return false
  }

  isKeyPrintable(e: KeyboardEvent) {
    return allKeys.indexOf(e.key) === -1;
  }

  getRandomInt(max: any) {
    return Math.floor(Math.random() * max);
  }

  getRandomIntSeeded(max: number, seed: number) {
    let rand = seedrandom(seed)
    return Math.floor(rand() * max)
  }

  //used for random seeding
  daysSinceEpoch(){
    let now: any = new Date()
    return Math.floor(now/8.64e7)
  }

  toast(text: string, duration?: number){
    let toastDuration = duration || this.DEFAULT_TOAST_DURATION
    window.clearTimeout(this.toastTimeout)
    let that = this;
    this.toastText = text;
    this.showToast = true;
    this.initialHideToast = false;
    this.toastTimeout = setTimeout(function(){
      that.showToast = false;
    }, toastDuration);
  }

  scrollGameToBottom(){
    let el = document.getElementById("letters-row-wrapper")
    setTimeout(function(){
      el?.scrollTo({
        top: el.scrollHeight,
        behavior: 'smooth'
      })
    }, 1)
  }

  renderConfetti(){
    const canvas = this.renderer2.createElement('canvas');
 
    this.renderer2.appendChild(this.elementRef.nativeElement, canvas);
 
    const myConfetti = confetti.create(canvas, {
      resize: true // will fit all screen sizes
    });
 
    myConfetti({
      
        particleCount: 150,
        ticks: 75,
        spread: 70,
        angle: 60,
        origin: { y: 0.5, x: 0 }
      
    });

    myConfetti({
      
      particleCount: 150,
      ticks: 75,
      spread: 70,
      angle: 120,
      origin: { y: 0.5, x: 1 }
    
    });
  }

  renderWinConfetti(){
    const canvas = this.renderer2.createElement('canvas');
 
    this.renderer2.appendChild(this.elementRef.nativeElement, canvas);
 
    const myConfetti = confetti.create(canvas, {
      resize: true // will fit all screen sizes
    });

    myConfetti({
      
      particleCount: 150,
      spread: 70,
      angle: 60,
      origin: { y: 0.33, x: 0 }
    
    });

    myConfetti({
      
      particleCount: 150,
      spread: 70,
      angle: 120,
      origin: { y: 0.33, x: 1 }
    
    });

    setTimeout(function(){
      myConfetti({
      
        particleCount: 150,
        spread: 70,
        angle: 60,
        origin: { y: 0.5, x: 0 }
      
    });

    myConfetti({
      
      particleCount: 150,
      spread: 70,
      angle: 120,
      origin: { y: 0.5, x: 1 }
    
    });
    }, 500);

    setTimeout(function(){
      myConfetti({
      
        particleCount: 150,
        spread: 70,
        angle: 60,
        origin: { y: 0.66, x: 0 }
      
    });

    myConfetti({
      
      particleCount: 150,
      spread: 70,
      angle: 120,
      origin: { y: 0.66, x: 1 }
    
    });
    }, 1000);

    setTimeout(function(){
      myConfetti({
      
        particleCount: 150,
        spread: 70,
        angle: 60,
        origin: { y: 0.8, x: 0 }
      
    });

    myConfetti({
      
      particleCount: 150,
      spread: 70,
      angle: 120,
      origin: { y: 0.8, x: 1 }
    
    });
    }, 1500);

  }
}