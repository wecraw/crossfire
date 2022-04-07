import { Component, ElementRef, HostListener, OnInit, Renderer2 } from '@angular/core';
import { mondayClues } from '../clues/monday';
import { tuesdayClues } from '../clues/tuesday';
import { wednesdayClues } from '../clues/wednesday';
import { thursdayClues } from '../clues/thursday';
import { fridayClues } from '../clues/friday';
import { saturdayClues } from '../clues/saturday';
import { sundayClues } from '../clues/sunday';
import { allKeys } from '../keys';
import * as confetti from 'canvas-confetti';

export interface IClue {
  clueNumber: number;
  clue: any;
  answer: any;
}

export interface ILetter {
  letter: any;
  state: "default" | "correct" | "incorrect"
}

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})

export class GameComponent implements OnInit {
  title = 'crossfire-ng';
  clue: IClue = {
    clueNumber: 0,
    clue: "",
    answer: ""
  };

  showHelpModal = false;


  letters: ILetter[] = []
  enteredLetters: ILetter[] = []
  entryIndex: number = 0;
  days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ]
  cluesArray = [
    mondayClues,
    tuesdayClues,
    wednesdayClues,
    thursdayClues,
    fridayClues,
    saturdayClues,
    sundayClues
  ]
  clueSeeds: number[]
  solved: boolean = false;
  guessNotAllowed: boolean = false;
  currentLevel: number = 0;
  currentDisplayLevel: number = 0; //need this to make the transition for the progress bar, it updates after the true level does
  incorrectGuesses: number = 0;
  invalidGuessAnimation: boolean = false; //used to show shake animation when an invalid guess is submitted
  
  showToast: boolean = false; //used to show and hide the 'need more letters' toast
  initialHideToast: boolean = true; //used to hide boolean on initial load to prevent the fade out from happening on load
  toastText: string = "";
  toastTimeout: any;

  showResetModal: boolean = false;
  showLossModal: boolean = false;
  showWinModal: boolean = false;

  shakeChecks: boolean = false; //used to shake x's when incorrect guess

  MAX_INCORRECT_GUESSES: number = 8;
  DEFAULT_TOAST_DURATION: number = 1500; //how long the toast appears for, in milliseconds

  constructor(
    private renderer2: Renderer2,
    private elementRef: ElementRef
  ){}


  ngOnInit(): void {
    this.setClueSeeds()
    this.setClue()
  }

  reset(){
    this.currentLevel = this.currentDisplayLevel = this.incorrectGuesses = this.entryIndex = 0;
    this.showResetModal = this.showLossModal = this.showWinModal = false;
    this.guessNotAllowed = false;
    this.setClueSeeds()
    this.setClue()
  }



  setClueSeeds(){
    this.clueSeeds = [];
    this.cluesArray.forEach(clueSet => {
      this.clueSeeds.push(this.getRandomInt(clueSet.length-1))
    })
  }


  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
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

  handleLetterEntry(letter: any){
    if(this.enteredLetters[this.entryIndex].state !== "correct"){
      this.enteredLetters[this.entryIndex].letter = letter
      this.enteredLetters[this.entryIndex].state = "default"
    }
    if (this.entryIndex < this.clue.answer.length - 1){
      this.entryIndex++
    }
  }

  handleDeleteLetter(){
    let deleteIndex
    if (this.enteredLetters[this.entryIndex].letter !== ""){
      deleteIndex = this.entryIndex
      if (this.enteredLetters[this.entryIndex].state === "correct"){
        this.entryIndex--
        deleteIndex--
      }
    } else {
      deleteIndex = this.entryIndex - 1
      this.entryIndex--
    } 
    
    if (deleteIndex < 0) deleteIndex = 0
    if (this.entryIndex < 0) this.entryIndex = 0

    if (this.enteredLetters[deleteIndex].state !== "correct"){
      this.enteredLetters[deleteIndex].letter = ""
      if(this.enteredLetters[deleteIndex].state === "incorrect"){
        this.enteredLetters[deleteIndex].state = "default"
      }
    }

  }

  setClue(){
    this.clue = {
      clueNumber: +this.cluesArray[this.currentLevel][this.clueSeeds[this.currentLevel]][0],
      clue: this.cluesArray[this.currentLevel][this.clueSeeds[this.currentLevel]][1],
      answer: this.cluesArray[this.currentLevel][this.clueSeeds[this.currentLevel]][2]
    }
    this.setLetters(this.clue.answer)

  }

  getState(i: any){
    if (i < this.enteredLetters.length){
      return this.enteredLetters[i].state
    } else {
      return ""
    }
  }

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

  setLetters(answer: any){
    this.letters = [];
    this.enteredLetters = [];
    Array.from(answer).forEach(letter => {
      this.letters.push({
        letter: letter,
        state: 'default' 
      })
      this.enteredLetters.push({ //fill entered letter array with empty letters
        letter: "",
        state: "default"
      })
    })
  }

  getNewPuzzle(){
    let that = this

    setTimeout(function(){
      that.setClue()
      that.entryIndex = 0;
      that.solved = false;
      that.currentDisplayLevel = that.currentLevel
      that.guessNotAllowed = false; //need to reset this from the check answer func
    }, 500);
  }

  isAnswerValid(){
    let validGuess = true;
    this.enteredLetters.forEach(letter => {
      if (letter.letter === "") validGuess = false
    })    
    return validGuess

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

  checkAnswer(){
    let correctLetters = 0;
    let that = this;

    //check if any squares are empty and if so, abort the check
    if (!this.isAnswerValid()){
      this.invalidGuessAnimation = true;
      this.toast("Not enough letters")
      setTimeout(function(){
        that.invalidGuessAnimation = false;
      }, 700);
      return
    }
    if (this.guessNotAllowed) return


    this.letters.forEach((letter, i) => {
      if (this.enteredLetters[i].letter !== ""){
        if(letter.letter === this.enteredLetters[i].letter){
          this.enteredLetters[i].state = "correct"
          correctLetters++
        } else {
          this.enteredLetters[i].state = "incorrect"
        }
      }
    })
    if (correctLetters === this.letters.length){
      this.guessNotAllowed = true
      this.currentLevel++
      if (this.currentLevel === 7){
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
      this.shakeChecks = true;
      setTimeout(function(){
        that.shakeChecks = false;
      }, 300);
      if (this.incorrectGuesses === this.MAX_INCORRECT_GUESSES){
        this.guessNotAllowed = true;
        this.handleLoss()
      }
    }

  }

  handleLoss(){
    let that = this;
    let toastDuration = 2250
    this.toast(this.clue.answer, toastDuration)

    setTimeout(function(){ //wait until toast finishes to launch the modal
      that.showLossModal = true
    }, toastDuration + 500);
  }

  handleWin(){
    let that = this;
    this.renderWinConfetti()
    setTimeout(function(){ //wait until toast finishes to launch the modal
      that.showWinModal = true
    }, 2000); //wait until victory confetti finishes
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

  toggleHelpModal(){
    this.showHelpModal = !this.showHelpModal
  }

  toggleResetModal(){
    this.showResetModal = !this.showResetModal;
  }

  onSettingsClick(){
    this.toggleResetModal();

    //todo launch settings menu
  }

  share(){
    let shareString = "Crawsword (beta)\n\n"
    for(let i = 0; i < 7; i++){
      if(i < this.currentLevel) shareString += "🟦"
      if(i === this.currentLevel) shareString += "🟨"
      if(i > this.currentLevel) shareString += "⬛"
    }
    shareString += "\n"; //newline
    for (let i = 0; i < this.MAX_INCORRECT_GUESSES; i++){
      if(i <= this.incorrectGuesses) shareString += "❌"
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

  /*------------------------------Helpers-------------------------------------*/

  isKeyPrintable(e: KeyboardEvent) {
    return allKeys.indexOf(e.key) === -1;
  }

  getRandomInt(max: any) {
    return Math.floor(Math.random() * max);
  }

  renderConfetti(){
    const canvas = this.renderer2.createElement('canvas');
 
    this.renderer2.appendChild(this.elementRef.nativeElement, canvas);
 
    const myConfetti = confetti.create(canvas, {
      resize: true // will fit all screen sizes
    });
 
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