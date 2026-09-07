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
import { UsuariosRoles } from './usuarios-roles/usuarios-roles';

export const routes: Routes = [

  { path: '', component: Landepage },
  { path: 'register', component: Register },
  { path: 'iniciodesesionadministrador', component: InicioDeSesionAdministradorComponent },

  // AQUÍ ESTÁ EL CAMBIO: 'inicio-admin' envuelve a todos los módulos con children
  {
    path: 'inicio-admin',
    component: InicioAdministradorComponent,
    children: [
      { path: 'patologias', component: Patologias },
      { path: 'examenes-clinicos', component: ExamenesClinicos },
      { path: 'examen-clinico', component: ExamenClinico },
      { path: 'editar-examen', component: EditarExamen },
      { path: 'usuarios-roles', component: UsuariosRoles },
      { path: 'examenes-clinicos', component: ExamenClinico },
      
      { path: 'listarespecies', component: ListarEspecies },
      { path: 'crearespecies', component: CrearEspecies },
      { path: 'formularioespecies', component: FormularioEspecies },
      { path: 'actualizarespecies/:id', component: ActualizarEspecies },
      
      { path: 'listarmedicamentos', component: ListarMedicamentos },
      { path: 'crearmedicamentos', component: CrearMedicamentos },
      { path: 'formulariomedicamentos', component: FormularioMedicamentos },
      { path: 'actualizarmedicamentos/:id', component: ActualizarMedicamentos }
    ]
  }
];