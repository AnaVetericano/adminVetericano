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

import { InicioAdministrador } from './Inicio-administrador/Inicio-administrador';
import { InicioDeSesionAdministrador } from './inicio-de-sesion-administrador/inicio-de-sesion-administrador';

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
    path: 'registro-administrador',
    component: InicioAdministrador
  },

  {
    path: 'inicio-de-sesion-administrador',
    component: InicioDeSesionAdministrador
  },

  {
    path: 'login',
    component: Login
  },

  {
    path: 'register',
    component: Register
  }

];
