import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { Router,RouterLink } from '@angular/router';

@Component({
  selector: 'app-patologias',
  imports: [CommonModule,RouterLink],
  templateUrl: './patologias.html',
  styleUrl: './patologias.css',
})
export class Patologias {
   constructor(private router: Router) {}

   crearpatoo():void {
    this.router.navigate(['/crear-pa']);
  }


  
}
