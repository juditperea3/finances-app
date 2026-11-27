import { Injectable, signal } from '@angular/core';
@Injectable({providedIn:'root'})
export class ThemeService {
  readonly dark=signal(false);
  constructor(){
    const stored=localStorage.getItem('finances-theme');
    const prefers=window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.apply(stored ? stored==='dark' : prefers, false);
  }
  toggle(){ this.apply(!this.dark()); }
  private apply(isDark:boolean,persist=true){
    this.dark.set(isDark);
    document.documentElement.dataset['theme']=isDark?'dark':'light';
    if(persist) localStorage.setItem('finances-theme',isDark?'dark':'light');
  }
}
