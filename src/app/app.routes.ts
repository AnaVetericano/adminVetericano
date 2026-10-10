import { Routes } from '@angular/router';

import { Medicamentos } from './crear-medicamentos/crear-medicamentos';
import { Especies } from './especies/especies';
import { Landepage } from './landepage/landepage';
import { Register } from './register/register';

import { InicioAdministradorComponent } from './Inicio-administrador/Inicio-administrador';
import { InicioDeSesionAdministradorComponent } from './inicio-de-sesion-administrador/inicio-de-sesion-administrador';
import { Patologias } from './patologias/patologias';
import { ExamenesClinicos } from './examenes-clinicos/examenes-clinicos';
import { UsuariosRoles } from './usuarios-roles/usuarios-roles';
import { Graficas } from './graficas/graficas';
import { Peticion } from './peticion/peticion';
import { Voluntarios } from './voluntarios/voluntarios';
import { EventosVoluntariado } from './eventos-voluntariado/eventos-voluntariado';
import { Adopciones } from './adopciones/adopciones';
import { ActaSeresSintientes } from './acta-seres-sintientes/acta-seres-sintientes';
import { HistoriaClinica2Component } from './historia-clinica/historia-clinica';
import { Proveedores } from './proveedores/proveedores';
import { authGuard, loginGuard, roleGuard } from './services/auth.guard';
import { Compra } from './compra/compra';
import { Inventario } from './inventario/inventario';

export const routes: Routes = [
  { path: '', component: Landepage },
  { path: 'register', component: Register, canActivate: [loginGuard] },
  { path: 'iniciodesesionadministrador', component: InicioDeSesionAdministradorComponent, canActivate: [loginGuard] },

  {
    path: 'inicio-admin',
    component: InicioAdministradorComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      // Módulo Administrador / Entrada general
      { path: '', component: Graficas, canActivate: [roleGuard], data: { roles: ['Administrador', 'Veterinario'] } },
      { path: 'graficas', component: Graficas, canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'usuarios-roles', component: UsuariosRoles, canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'voluntarios', component: Voluntarios, canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'eventos-voluntariado', component: EventosVoluntariado, canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'adopciones', component: Adopciones, canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'proveedores', component: Proveedores, canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'compras', component: Compra, canActivate: [roleGuard], data: { roles: ['Administrador'] } },
      { path: 'inventario', component: Inventario, canActivate: [roleGuard], data: { roles: ['Administrador'] } },

      // Módulo Veterinario (y Administrador con acceso de supervisión)
      { path: 'acta-seres-sintientes', component: ActaSeresSintientes, canActivate: [roleGuard], data: { roles: ['Veterinario', 'Administrador'] } },
      { path: 'historia-clinica2', component: HistoriaClinica2Component, canActivate: [roleGuard], data: { roles: ['Veterinario', 'Administrador'] } },

      // Módulos compartidos / Catálogos clínicos
      { path: 'patologias', component: Patologias, canActivate: [roleGuard], data: { roles: ['Administrador', 'Veterinario'] } },
      { path: 'examenes-clinicos', component: ExamenesClinicos, canActivate: [roleGuard], data: { roles: ['Administrador', 'Veterinario'] } },
      { path: 'especies', component: Especies, canActivate: [roleGuard], data: { roles: ['Administrador', 'Veterinario'] } },
      { path: 'listarmedicamentos', component: Medicamentos, canActivate: [roleGuard], data: { roles: ['Administrador', 'Veterinario'] } },
      { path: 'crear-medicamentos', component: Medicamentos, canActivate: [roleGuard], data: { roles: ['Administrador', 'Veterinario'] } },
      { path: 'peticion', component: Peticion, canActivate: [roleGuard], data: { roles: ['Administrador', 'Veterinario'] } }
    ]
  }
];

