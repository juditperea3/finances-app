import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
@Injectable({providedIn:'root'})
export class AuthService {
  private readonly sb=inject(SupabaseService).client;
  async currentUser() { const {data,error}=await this.sb.auth.getUser(); if(error) return null; return data.user; }
  async signIn(email:string,password:string) { const {error}=await this.sb.auth.signInWithPassword({email,password}); if(error) throw error; }
  async signOut() { const {error}=await this.sb.auth.signOut(); if(error) throw error; }
}
