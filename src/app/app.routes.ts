import { Routes } from '@angular/router';

import { ActualizarEspecies } from './actualizar-especies/actualizar-especies';
import { ActualizarMedicamentos } from './actualizar-medicamentos/actualizar-medicamentos';
import { ListarEspecies } from './listar-especies/listar-especies';
import { ListarMedicamentos } from './listar-medicamentos/listar-medicamentos';
import { CrearEspecies } from './crear-especies/crear-especies';
import { CrearMedicamentos } from './crear-medicamentos/crear-medicamentos';
import { FormularioEspecies } from './formulario-especies/formulario-especies';
import { FormularioMedicametos } from './formulario-medicametos/formulario-medicametos';

import { Login } from './login/login';
import { Register } from './register/register';

import { InicioAdministradorComponent } from './Inicio-administrador/Inicio-administrador';
import { InicioDeSesionAdministradorComponent } from './inicio-de-sesion-administrador/inicio-de-sesion-administrador';
import { Patologias } from './patologias/patologias';

export const routes: Routes = [

  {
    path: '',
    component: Login
  },

  {
    path: 'formularioespecies',
    component: FormularioEspecies
  },

  {
    path: 'actualizarespecies',
    component: ActualizarEspecies
  },

  {
    path: 'crearespecies',
    component: CrearEspecies
  },

  {
    path: 'listarespecies',
    component: ListarEspecies
  },

  {
    path: 'actualizarmedicamentos',
    component: ActualizarMedicamentos
  },

  {
    path: 'listarmedicamentos',
    component: ListarMedicamentos
  },

  {
    path: 'crearmedicamentos',
    component: CrearMedicamentos
  },

  {
    path: 'formulariomedicamentos',
    component: FormularioMedicametos
  },

  {
    path: ' Inicio-administrador',
    component: InicioAdministradorComponent
  },

  {
    path: 'inicio-de-sesion-administrador',
    component: InicioDeSesionAdministradorComponent
  },

  {
    path: 'login',
    component: Login
  },

  {
    path: 'register',
    component: Register
  },

  {path: 'examenes-clinicos', 
    component:ExamenesClinicos},

    
  {path:'patologias', 
    component:Patologias}


];
