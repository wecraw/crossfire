import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  standalone: false,
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent {

  @Output() closed = new EventEmitter<void>();
  @Output() faq = new EventEmitter<void>();

  closeEvent(){
    this.closed.emit()
  }

  faqEvent(){
    this.faq.emit()
  }

  isDarkMode(){
    const storedTheme = localStorage.getItem('theme') || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (storedTheme === 'dark') return true
    return false
  }

  isContrastMode(){
    const storedTheme = localStorage.getItem('contrast-theme');
    if (storedTheme === 'contrast') return true
    return false
  }

  darkModeSwitchChange(){
    const currentTheme = document.documentElement.getAttribute("data-theme");
    let targetTheme = "light";

    if (currentTheme === "light") {
      targetTheme = "dark";
    }

    document.documentElement.setAttribute('data-theme', targetTheme)
    localStorage.setItem('theme', targetTheme);
  }

  contrastSwitchChange(){
    const currentTheme = document.documentElement.getAttribute("data-contrast-theme");
    let targetTheme = "default";

    if (currentTheme === "default") {
      targetTheme = "contrast";
    }

    document.documentElement.setAttribute('data-contrast-theme', targetTheme)
    localStorage.setItem('contrast-theme', targetTheme);
  }

}
