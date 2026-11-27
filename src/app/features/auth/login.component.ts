import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
@Component({standalone:true,imports:[FormsModule],template:`<section class="panel login"><h1>Benvinguda a Finances</h1><p>Accés privat a les teves finances.</p><form (ngSubmit)="submit()"><label>Email<input name="email" type="email" [(ngModel)]="email" required autocomplete="email"></label><label>Contrasenya<input name="password" type="password" [(ngModel)]="password" required autocomplete="current-password"></label><button [disabled]="busy()">Entrar</button></form>@if(error()){<p role="alert" class="error">{{error()}}</p>}</section>`})
export class LoginComponent {email='';password='';busy=signal(false);error=signal('');private auth=inject(AuthService);private router=inject(Router);async submit(){this.busy.set(true);this.error.set('');try{await this.auth.signIn(this.email,this.password);await this.router.navigateByUrl('/');}catch(e:any){this.error.set(e?.message||'No s’ha pogut iniciar sessió');}finally{this.busy.set(false);}}}
