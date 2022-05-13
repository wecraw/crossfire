import { Component, EventEmitter, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit {

  @Output() onClose = new EventEmitter<any>();
  @Output() onFaq = new EventEmitter<any>();

  constructor() { }

  closeEvent(){
    this.onClose.emit()
  }

  faqEvent(){
    this.onFaq.emit()
  }

  isDarkMode(){
    let currentTheme = document.documentElement.getAttribute("data-theme");
    var storedTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (storedTheme === 'dark') return true
    return false
  }
  
  isContrastMode(){
    let currentTheme = document.documentElement.getAttribute("data-contrast-theme");
    var storedTheme = localStorage.getItem('contrast-theme');
    if (storedTheme === 'contrast') return true
    return false
  }

  darkModeSwitchChange(event: any){
    let currentTheme = document.documentElement.getAttribute("data-theme");
    let targetTheme = "light";

    if (currentTheme === "light") {
      targetTheme = "dark";
    }

    document.documentElement.setAttribute('data-theme', targetTheme)
    localStorage.setItem('theme', targetTheme);
  }

  contrastSwitchChange(event: any){
    let currentTheme = document.documentElement.getAttribute("data-contrast-theme");
    let targetTheme = "default";

    if (currentTheme === "default") {
      targetTheme = "contrast";
    }

    document.documentElement.setAttribute('data-contrast-theme', targetTheme)
    localStorage.setItem('contrast-theme', targetTheme);    
  }

  ngOnInit(): void {
    
  }

}
