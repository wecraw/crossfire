import { Component, ElementRef, HostListener, OnInit, Renderer2 } from '@angular/core';
import { mondayClues } from '../clues/monday';
import { tuesdayClues } from '../clues/tuesday';
import { wednesdayClues } from '../clues/wednesday';
import { thursdayClues } from '../clues/thursday';
import { fridayClues } from '../clues/friday';
import { saturdayClues } from '../clues/saturday';
import { sundayClues } from '../clues/sunday';
import { answers } from '../clues/answers';
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
  title = 'crossfire-ng';
  clue: IClue = {
    clueNumber: 0,
    clue: "",
    answer: ""
  };

  gameWindowHeight: number;

  showHelpModal = false;

  submissions: ILetter[][] = []
  letters: string[] = []
  enteredLetters: ILetter[] = []

  //used for keyboard highlighting
  presentLetters: string[] = []
  absentLetters: string[] = []
  correctLetters: string[] = []

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
  clueSeeds: number[];
  solved: boolean = false;
  guessNotAllowed: boolean = false;
  currentLevel: number = 0;
  currentDisplayLevel: number = 0; //need this to make the transition for the progress bar, it updates after the true level does
  incorrectGuesses: number = 0;
  invalidGuessAnimation: boolean = false; //used to show shake animation when an invalid guess is submitted
  
  showToast: boolean = false; //used to show and hide the 'need more letters' toast
  initialHideToast: boolean = true; //used to hide boolean on initial load to prevent the fade out from happening on load
  toastText: string = "";
  invalidReason: string = ""; //reason for why a guess is invalid, shown in toast text
  toastTimeout: any;

  showResetModal: boolean = false;
  showLossModal: boolean = false;
  showWinModal: boolean = false;

  shakeChecks: boolean = false; //used to shake x's when incorrect guess

  MAX_INCORRECT_GUESSES: number = 10;
  DEFAULT_TOAST_DURATION: number = 1500; //how long the toast appears for, in milliseconds

  constructor(
    private renderer2: Renderer2,
    private elementRef: ElementRef
  ){}


  ngOnInit(): void {
    this.setClueSeeds()
    this.setClue()
    this.gameWindowHeight = window.innerHeight - 265
  }

  reset(){
    this.submissions = []
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

    this.enteredLetters[this.entryIndex].letter = letter
  
    if (this.entryIndex < this.clue.answer.length - 1){
      this.entryIndex++
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

  getState(i: any){
    if (i < this.enteredLetters.length){
      return this.enteredLetters[i].state
    } else {
      return ""
    }
  }

  getLetter(i: any){ //fill empty letters on board
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
    this.enteredLetters = [];
    this.absentLetters = []
    this.presentLetters = []
    this.correctLetters = []

    Array.from(answer).forEach(letter => {
      this.letters.push(letter)
      this.enteredLetters.push({ //fill entered letter array with empty letters
        letter: "",
        state: "default"
      })
    })    
  }

  getNewPuzzle(){
    let that = this

    setTimeout(function(){
      that.submissions = []
      that.setClue()
      that.entryIndex = 0;
      that.solved = false;
      that.currentDisplayLevel = that.currentLevel
      that.guessNotAllowed = false; //need to reset this from the check answer func
    }, 500);
  }

  isAnswerValid(){
    let validGuess = true;
    
    //check if any squares are empty
    this.enteredLetters.forEach(letter => {
      if (letter.letter === "") {
        validGuess = false
        this.invalidReason = "Not enough letters"
      }
    })

    //if no squares empty, check if answer exists in the set of valid answers
    if (validGuess){
      let enteredAnswer = ""
      this.enteredLetters.forEach(letter => {
        enteredAnswer += letter.letter
      })
      validGuess = answers.includes(enteredAnswer.toUpperCase())
      if (!validGuess) this.invalidReason = "Not a valid answer"
    }
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
        // console.log("checking " + letter) uncomment to console log answers
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
      this.entryIndex = -1 //to hide highlighter during confetti
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
        this.entryIndex = -1
        this.handleLoss()
      } else {
        this.submissions.push(this.enteredLetters)
        let el = document.getElementById("letters-row-wrapper")
        this.enteredLetters = []
        this.letters.forEach(letter => {
          this.enteredLetters.push({
            letter: "",
            state: "default"
          })
        })
        this.entryIndex = 0;
        
        //need to put this in a 1ms timeout so that the view has a chance to update before the scroll runs
        setTimeout(function(){
          el?.scrollTo({
            top: el.scrollHeight,
            behavior: 'smooth'
          })
        }, 1)
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
