import { Routes } from '@angular/router';

import { ActualizarEspecies } from './actualizar-especies/actualizar-especies';
import { ActualizarMedicamentos } from './actualizar-medicamentos/actualizar-medicamentos';
import { ListarEspecies } from './listar-especies/listar-especies';
import { ListarMedicamentos } from './listar-medicamentos/listar-medicamentos';
import { CrearEspecies } from './crear-especies/crear-especies';
import { CrearMedicamentos } from './crear-medicamentos/crear-medicamentos';
import { FormularioEspecies } from './formulario-especies/formulario-especies';
import { FormularioMedicamentos } from './formulario-medicamentos/formulario-medicamentos';

import { Landepage } from './landepage/landepage';
import { Register } from './register/register';

import { InicioAdministradorComponent } from './Inicio-administrador/Inicio-administrador';
import { InicioDeSesionAdministradorComponent } from './inicio-de-sesion-administrador/inicio-de-sesion-administrador';
import { Patologias } from './patologias/patologias';
import { ExamenesClinicos } from './examenes-clinicos/examenes-clinicos';
import { ExamenClinico } from './examen-clinico/examen-clinico';
import { EditarExamen } from './editar-examen/editar-examen';
import { CrearPa } from './crear-pa/crear-pa';

export const routes: Routes = [

  {
    path: '',
    component:Landepage
  },
  
  {
    path: 'formularioespecies',
    component: FormularioEspecies
  },

  {
    path: 'actualizarespecies/:id',
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
    path: 'actualizarmedicamentos/:id',
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
    component: FormularioMedicamentos
  },

  {
    path: 'inicio-admin',
    component: InicioAdministradorComponent
  },

  {
    path: 'iniciodesesionadministrador',
    component: InicioDeSesionAdministradorComponent
  },

  

  {
    path: 'register',
    component: Register
  },

  {path: 'examenes-clinicos', 
    component:ExamenesClinicos},


  {path:'patologias', 
    component:Patologias},


  {path:'examen-clinico',
    component:ExamenClinico
  },


  {path:'editar-examen',
    component:EditarExamen
  },

  {path:'crear-pa',
    component:CrearPa
  }


];
