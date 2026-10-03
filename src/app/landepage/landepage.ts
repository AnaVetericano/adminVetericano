import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landepage',
  imports: [RouterLink],
  templateUrl: './landepage.html',
  styleUrl: './landepage.css',
})
export class Landepage implements OnInit {
  constructor(private router: Router) {}

  ngOnInit(): void {
    // Sesión persistente: si ya hay token, entrar directo al panel.
    // Solo se sale con "Cerrar sesión" del sidebar.
    if (localStorage.getItem('token')) {
      this.router.navigate(['/inicio-admin']);
    }
  }

  iniciarSesion(): void {
    if (localStorage.getItem('token')) {
      this.router.navigate(['/inicio-admin']);
      return;
    }
    this.router.navigate(['/iniciodesesionadministrador']);
  }

  registrarse(): void {
    this.router.navigate(['/register']);
  }

}
