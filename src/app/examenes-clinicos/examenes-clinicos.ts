import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router,RouterLink } from '@angular/router';

@Component({
  selector: 'app-examenes-clinicos',
  imports: [CommonModule,RouterLink],
  templateUrl: './examenes-clinicos.html',
  styleUrl: './examenes-clinicos.css',
})
export class ExamenesClinicos {
  constructor(private router: Router) {}
  ediex(){
    this.router.navigate(['/editar-examen'])
  }

  irACrearExamen() {
    this.router.navigate(['/examen-clinico']);
  }

 


    
}
