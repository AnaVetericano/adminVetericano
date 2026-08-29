import { Component } from '@angular/core';
import { Router } from '@angular/router';
@Component({
  selector: 'app-landepage',
  imports: [],
  templateUrl: './landepage.html',
  styleUrl: './landepage.css',
})
export class Landepage {
  constructor(private router: Router) {}

  iniciarSesion(): void {
    this.router.navigate(['/iniciodesesionadministrador']);
  }

  registrarse(): void {
    this.router.navigate(['/register']);
  }

}
