import { Component, ElementRef, HostListener, OnInit, Renderer2 } from '@angular/core';
import { mondayClues } from './clues/monday';
import { tuesdayClues } from './clues/tuesday';
import { wednesdayClues } from './clues/wednesday';
import { thursdayClues } from './clues/thursday';
import { fridayClues } from './clues/friday';
import { saturdayClues } from './clues/saturday';
import { sundayClues } from './clues/sunday';
import { allKeys } from './keys';
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
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  title = 'crossfire-ng';
  clue: IClue = {
    clueNumber: 0,
    clue: "",
    answer: ""
  };
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
  clueSeeds = [
    this.getRandomInt(mondayClues.length-1),
    this.getRandomInt(tuesdayClues.length-1),
    this.getRandomInt(wednesdayClues.length-1),
    this.getRandomInt(thursdayClues.length-1),
    this.getRandomInt(fridayClues.length-1),
    this.getRandomInt(saturdayClues.length-1),
    this.getRandomInt(sundayClues.length-1)
  ]
  solved: boolean = false;
  currentLevel: number = 0;

  @HostListener('window:keyup', ['$event'])
  keyEvent(event: KeyboardEvent) {
    if(this.isKeyPrintable(event)){
        if(this.enteredLetters[this.entryIndex].state !== "correct"){
          this.enteredLetters[this.entryIndex].letter = event.key.toUpperCase()
          this.enteredLetters[this.entryIndex].state = "default"
        }
        if (this.entryIndex < this.clue.answer.length - 1){
          this.entryIndex++
        }
    }
    if(event.key === "Backspace"){ //handle delete characters and move index on backspace
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
    if(event.key === "Enter" && this.enteredLetters.length === this.letters.length){
      console.log("checking")
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
    console.log(this.enteredLetters)

  }

  constructor(
    private renderer2: Renderer2,
    private elementRef: ElementRef
  ){}


  ngOnInit(): void {
    let clueSeed = this.getRandomInt(mondayClues.length-1)
    this.setClue()

  }

  click(){
    this.renderConfetti()
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

  isKeyPrintable(e: KeyboardEvent) {
    return allKeys.indexOf(e.key) === -1;
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

  getLevelState(i: number){
    if (i === this.currentLevel) return "current"
    if (i < this.currentLevel) return "complete"
    if (i > this.currentLevel) return "upcoming"
    return ""
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

  checkAnswer(){
    let correctLetters = 0;
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
      console.log("you win!")
      this.renderConfetti()
      this.currentLevel++
      this.solved = true;
      this.setClue()
    }

  }

  getRandomInt(max: any) {
    return Math.floor(Math.random() * max);
  }

}
