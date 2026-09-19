import { Routes } from '@angular/router';

import { Medicamentos } from './crear-medicamentos/crear-medicamentos';
import { FormularioEspecies } from './formulario-especies/formulario-especies';
import { Especies } from './especies/especies';
import { Landepage } from './landepage/landepage';
import { Register } from './register/register';

import { InicioAdministradorComponent } from './Inicio-administrador/Inicio-administrador';
import { InicioDeSesionAdministradorComponent } from './inicio-de-sesion-administrador/inicio-de-sesion-administrador';
import { Patologias } from './patologias/patologias';
import { ExamenesClinicos } from './examenes-clinicos/examenes-clinicos';
import { ExamenClinicoComponent } from './examen-clinico/examen-clinico';
import { EditarExamen } from './editar-examen/editar-examen';
import { UsuariosRoles } from './usuarios-roles/usuarios-roles';
import { Graficas } from './graficas/graficas';
import { Peticion } from './peticion/peticion';
import { Voluntarios } from './voluntarios/voluntarios';


export const routes: Routes = [

  { path: '', component: Landepage },
  { path: 'register', component: Register },
  { path: 'iniciodesesionadministrador', component: InicioDeSesionAdministradorComponent },

  {
    path: 'inicio-admin',
    component: InicioAdministradorComponent,
    children: [
      { path: '', component: Graficas },
      { path: 'patologias', component: Patologias },
      { path: 'examenes-clinicos', component: ExamenesClinicos },
      { path: 'examen-clinico', component: ExamenClinicoComponent },
      { path: 'editar-examen', component: EditarExamen },
      { path: 'usuarios-roles', component: UsuariosRoles },
      { path: 'especies', component: Especies },
      { path: 'formularioespecies', component: FormularioEspecies },
      { path: 'listarmedicamentos', component: Medicamentos },
      { path: 'crear-medicamentos', component: Medicamentos },
      { path: 'graficas', component: Graficas },
      {path:'voluntarios',component:Voluntarios},
      {path:'peticion', component:Peticion},
    ]
  }
];
