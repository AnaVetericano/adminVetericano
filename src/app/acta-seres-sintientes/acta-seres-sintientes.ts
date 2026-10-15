import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth';
import { ComprasService } from '../services/compras.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { finalize, forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import Swal from 'sweetalert2';


@Component({
  selector: 'app-acta-seres-sintientes',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './acta-seres-sintientes.html',
  styleUrl: './acta-seres-sintientes.css',
})
export class ActaSeresSintientes implements OnInit {
  // Campos de diagnóstico y tratamiento
descripcionHallazgos = '';
diagnosticoFinal = '';
materialesUtilizados = '';
planProcedimientos = '';
pronostico = 'Favorable';

problemasClinicos: string[] = ['', '', '', '', '', '', ''];
diagnosticosDiferenciales: string[] = ['', '', '', '', '', '', ''];

// Datos de ingreso al CBA
ingresaCBA = 'NO';
motivoIngresoNoIngreso = '';
canilAsignado = '';
funcionarioRecibeCBA = '';
  mostrarNuevosCasos = true;
  

guardarExpedienteCompleto(): void {
  const animal = this.seguimientoSeleccionado;

  if (!animal) {
    Swal.fire(
      'Selecciona un animal',
      'Primero selecciona un animal de la lista de turnos.',
      'warning'
    );
    return;
  }

  const nombreAnimal =
    animal.nombre_paciente ||
    animal.nombre_animal ||
    animal.nombre ||
    '';

  if (!nombreAnimal.trim()) {
    Swal.fire(
      'Falta el nombre',
      'El animal seleccionado no tiene nombre.',
      'warning'
    );
    return;
  }

  // Adaptamos los datos del animal al formato de Django.
  const datos = {
    animal: {
      nombre: nombreAnimal,
      especie: animal.paciente_especie || 'Desconocida',
      raza: animal.paciente_raza || 'Mestizo',
      sexo: animal.paciente_sexo || '',
      color: animal.paciente_color || '',
      peso: animal.peso_paciente || null,
      descripcionBreve: animal.descripcion_paciente || '',
      caracteristicasEspeciales: '',
      numeroHistoriaClinica: this.numeroRadicadoActual || '',
      fotoUrl: animal.foto || ''
    },

    tenedor: {
      nombres:
        this.nombreAcudiente ||
        animal.notificador_nombre ||
        '',
      documentoIdentidad:
        this.cedulaAcudiente ||
        animal.notificador_identificacion ||
        '',
      telefono: animal.notificador_telefono || '',
      correoElectronico: animal.notificador_correo || '',
      direccion: animal.notificador_direccion || ''
    },

    anamnesicos: {},

    motivoConsulta:
      animal.observaciones ||
      animal.observacion ||
      animal.anamnesis_descripcion_queja ||
      '',

    examenClinico: {
      examenesSolicitados: this.examenesSolicitados.map(
        (examen: any) => ({
          nombre:
            examen.nombre ||
            examen.nombre_examen ||
            examen.nombre_tipo ||
            examen.tipo ||
            'Examen clínico'
        })
      )
    },

    organosSistemas: { ...this.sistemas },

    hoja2: {
      descripcionHallazgos: this.descripcionHallazgos,
      materialesUtilizados: this.materialesUtilizados,
      planProcedimientos: this.planProcedimientos,
      pronostico: this.pronostico,

      examenes: this.examenesSolicitados.map(
        (examen: any) => ({
          nombre:
            examen.nombre ||
            examen.nombre_examen ||
            examen.nombre_tipo ||
            examen.tipo ||
            'Examen clínico'
        })
      ),

      listaProblemas: this.problemasClinicos.filter(
        (problema: string) => problema.trim() !== ''
      ),

      diagnosticosDiferenciales:
        this.diagnosticosDiferenciales.filter(
          (diagnostico: string) => diagnostico.trim() !== ''
        ),

      diagnosticoFinal: this.diagnosticoFinal,

      tratamientos: this.medicamentosSeleccionados.map(
        (medicamento: any) => ({
          productoBase:
            medicamento.nombre ||
            medicamento.nombre_medicamento ||
            medicamento.medicamento ||
            medicamento.nombre_producto ||
            '',
          dosisBasica: medicamento.dosis || '',
          presentacion: medicamento.presentacion || '',
          via: medicamento.via || '',
          frecuenciaDuracion: medicamento.frecuencia || ''
        })
      )
    },

    hoja3: {
      ingresaCBA: this.ingresaCBA,
      motivoIngresoNoIngreso: this.motivoIngresoNoIngreso,
      canilAsignado: this.canilAsignado,
      funcionarioRecibeCBA: this.funcionarioRecibeCBA
    },

    rescate: {
      numeroRadicado: this.numeroRadicadoActual || ''
    }
  };

  console.log(
    'Datos que se enviarán al expediente:',
    datos
  );

  Swal.fire({
    title: '¿Guardar expediente?',
    text: 'Se enviarán los datos del animal, los exámenes, la evaluación, el diagnóstico y los tratamientos.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Sí, guardar',
    cancelButtonText: 'Cancelar'
  }).then((resultado) => {
    if (!resultado.isConfirmed) {
      return;
    }

    const token = localStorage.getItem('token');

    const headers = token
      ? new HttpHeaders({
          Authorization: `Bearer ${token}`
        })
      : new HttpHeaders();

    const url =
      'https://backendvetericano-production.up.railway.app/api/clinica/expediente-completo/';

    this.http.post<any>(url, datos, { headers }).subscribe({
      next: (respuesta) => {
        console.log('Expediente guardado correctamente:', respuesta);

        Swal.fire({
          title: '¡Expediente guardado!',
          text: `Historia clínica: ${
            respuesta.historia_id ?? 'registrada'
          }. Consulta: ${
            respuesta.consulta_id ?? 'registrada'
          }.`,
          icon: 'success',
          confirmButtonText: 'Aceptar'
        });
      },

      error: (error) => {
        console.error('Error al guardar:', error);
        console.error('Detalle del backend:', error.error);

        let mensaje = 'No fue posible guardar el expediente.';

        if (error.status === 400) {
          mensaje =
            'El servidor rechazó algunos datos. Revisa el detalle del error en la consola.';
        } else if (error.status === 401 || error.status === 403) {
          mensaje =
            'Tu sesión no tiene autorización para guardar el expediente.';
        } else if (error.status === 0) {
          mensaje =
            'No se pudo conectar con el servidor. Revisa la conexión y CORS.';
        }

        Swal.fire('Error al guardar', mensaje, 'error');
      }
    });
  });
}



  popalog = {
    logopop: 'images/Escudo_Popayan.svg'
  };

  pestanaActiva: 'consulta' | 'examenes' | 'diagnostico' | 'tratamientos' = 'consulta';

  // Seguimientos recibidos del backend
  seguimientos: any[] = [];
  seguimientosFiltrados: any[] = [];
  seguimientoSeleccionado: any = null;
  cargando = false;
  error = '';
  textoBusqueda = '';
  filtroEspecie = 'Todos';

  // Datos que se muestran en el aval profesional
  numeroRadicadoActual = '';
  nombreVeterinario = '';

  // Catálogo de medicamentos
  mostrarCatalogoMedicamentos = false;
  cargandoMedicamentos = false;
  mensajeMedicamentos = '';
  medicamentosCatalogo: any[] = [];
  medicamentosSeleccionados: any[] = [];
  mapaStockPorId: Map<number, number> = new Map();
  mapaStockPorNombre: Map<string, number> = new Map();

  // Catálogo y selección de exámenes
  mostrarExamenes = false;
  examenesClinicos: any[] = [];
  cargandoExamenes = false;
  mensajeExamenes = '';
  examenesSolicitados: any[] = [];

  // Evaluación física
  sistemas: { [key: string]: string } = {
    general: 'NE',
    hidratacion: 'NE',
    tegumentario: 'NE',
    ojos: 'NE',
    oidos: 'NE',
    nariz: 'NE',
    digestivo: 'NE',
    respiratorio: 'NE',
    nervioso: 'NE',
    musculoesqueletico: 'NE',
    cardiovascular: 'NE',
    genitourinario: 'NE'
  };

  constructor(
    private authService: AuthService,
    private comprasService: ComprasService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.cargarSeguimientos();
    this.cargarSistemasGuardados();
  }

  alternarNuevosCasos(): void {
    this.mostrarNuevosCasos = !this.mostrarNuevosCasos;
  }

  cambiarPestana(pestana: 'consulta' | 'examenes' | 'diagnostico' | 'tratamientos'): void {
    this.pestanaActiva = pestana;
  }

  obtenerFotoPaciente(paciente: any): string {
    if (!paciente) {
      return 'images/perro-default.png';
    }

    return (
      paciente.foto ||
      paciente.imagen ||
      paciente.foto_paciente ||
      paciente.imagen_paciente ||
      paciente.animales?.[0]?.foto ||
      paciente.animales?.[0]?.imagen ||
      'images/perro-default.png'
    );
  }

  imagenNoDisponible(event: Event): void {
    const imagen = event.target as HTMLImageElement;
    imagen.onerror = null;
    imagen.src = 'images/perro-default.png';
  }

  cargarSeguimientos(): void {
    this.cargando = true;
    this.error = '';

    this.authService.listarSeguimientos().subscribe({
      next: (respuesta: any) => {
        if (Array.isArray(respuesta)) {
          this.seguimientos = respuesta;
        } else if (Array.isArray(respuesta?.results)) {
          this.seguimientos = respuesta.results;
        } else if (Array.isArray(respuesta?.data)) {
          this.seguimientos = respuesta.data;
        } else {
          this.seguimientos = [];
        }

        this.aplicarFiltros();
        this.cargando = false;
        this.cdr.detectChanges();
        console.log('Seguimientos cargados:', this.seguimientos);
      },
      error: (error: any) => {
        console.error('Error cargando seguimientos:', error);
        this.error = 'No se pudieron cargar los seguimientos.';
        this.cargando = false;
        this.cdr.detectChanges();
      }
    });
  }

  filtrarPorEspecie(especie: string): void {
    this.filtroEspecie = especie;
    this.aplicarFiltros();
  }

  buscarSeguimientos(): void {
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    const texto = (this.textoBusqueda || '').trim().toLowerCase();

    this.seguimientosFiltrados = this.seguimientos.filter((seguimiento: any) => {
      const especie = String(seguimiento?.paciente_especie || '').trim().toLowerCase();
      const coincideEspecie =
        this.filtroEspecie === 'Todos' ||
        especie === this.filtroEspecie.trim().toLowerCase();

      const campos = [
        seguimiento?.nombre_paciente,
        seguimiento?.paciente_especie,
        seguimiento?.paciente_raza,
        seguimiento?.microchip
      ];

      const coincideTexto = !texto || campos.some((campo: any) =>
        String(campo || '').toLowerCase().includes(texto)
      );

      return coincideEspecie && coincideTexto;
    });
  }
cedulaAcudiente: string = '';
  
seleccionarSeguimiento(seguimiento: any): void {
  // Guardar el animal seleccionado
  this.seguimientoSeleccionado = seguimiento;

  // NOMBRE Y DOCUMENTO DEL TUTOR
  this.nombreAcudiente = String(
    seguimiento?.notificador_nombre ??
    seguimiento?.nombre_acudiente ??
    seguimiento?.nombre_tutor ??
    seguimiento?.tenedor?.nombres ??
    ''
  );

  this.cedulaAcudiente = String(
    seguimiento?.notificador_identificacion ??
    seguimiento?.cedula_acudiente ??
    seguimiento?.documento_identidad ??
    seguimiento?.tenedor?.documentoIdentidad ??
    ''
  );

  // NÚMERO DE RADICADO
  this.numeroRadicadoActual = String(
    seguimiento?.numero_radicado ??
    seguimiento?.radicado ??
    seguimiento?.codigo_radicado ??
    seguimiento?.numeroRadicado ??
    seguimiento?.numero ??
    seguimiento?.codigo ??
    ''
  );

  // DATOS DEL VETERINARIO
  const veterinario =
    seguimiento?.veterinario ??
    seguimiento?.usuario_veterinario ??
    seguimiento?.profesional ??
    seguimiento?.asignacion?.veterinario ??
    seguimiento?.peticion?.veterinario ??
    null;

  const nombreAnidado = veterinario
    ? [
        veterinario.nombre_completo,
        veterinario.nombre,
        veterinario.nombres,
        veterinario.first_name,
        veterinario.apellido,
        veterinario.apellidos,
        veterinario.last_name
      ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
    : '';

  this.nombreVeterinario = String(
    seguimiento?.nombre_veterinario ??
    seguimiento?.nombre_completo_veterinario ??
    seguimiento?.veterinario_nombre ??
    seguimiento?.profesional_nombre ??
    seguimiento?.nombre_profesional ??
    seguimiento?.medico_veterinario ??
    veterinario?.nombre_completo ??
    nombreAnidado ??
    ''
  );

  console.log('Seguimiento seleccionado:', seguimiento);
  console.log('Nombre del tutor:', this.nombreAcudiente);
  console.log('Cédula del tutor:', this.cedulaAcudiente);
  console.log('Veterinario asignado:', this.nombreVeterinario);

  this.cdr.detectChanges();
}

  // Catálogo de medicamentos
  desplegarMedicamentos(): void {
    this.mostrarCatalogoMedicamentos = !this.mostrarCatalogoMedicamentos;

    if (this.mostrarCatalogoMedicamentos && this.medicamentosCatalogo.length === 0) {
      this.cargarMedicamentos();
    }
  }

  cargarMedicamentos(): void {
    this.cargandoMedicamentos = true;
    this.mensajeMedicamentos = '';

    forkJoin({
      catalogo: this.authService.getMedicamentosCatalogo().pipe(
        map((respuesta: any) => {
          if (Array.isArray(respuesta)) return respuesta;
          if (Array.isArray(respuesta?.results)) return respuesta.results;
          if (Array.isArray(respuesta?.data)) return respuesta.data;
          return [];
        }),
        catchError(() => of([]))
      ),
      stock: this.comprasService.obtenerMapaStockMedicamentos().pipe(
        catchError(() => of({ porId: new Map<number, number>(), porNombre: new Map<string, number>() }))
      )
    }).subscribe({
      next: ({ catalogo, stock }) => {
        this.mapaStockPorId = stock.porId;
        this.mapaStockPorNombre = stock.porNombre;

        this.medicamentosCatalogo = catalogo.map((med: any) => {
          const id = Number(med?.id_medicamento ?? med?.id);
          const nombreKey = String(med?.nombre || '').trim().toLowerCase();
          const stockDisponible = (!isNaN(id) && stock.porId.has(id))
            ? (stock.porId.get(id) ?? 0)
            : (stock.porNombre.get(nombreKey) ?? 0);

          return {
            ...med,
            id_medicamento: id,
            stockDisponible
          };
        });

        if (this.medicamentosCatalogo.length === 0) {
          this.mensajeMedicamentos = 'El catálogo no contiene medicamentos.';
        }

        this.cargandoMedicamentos = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error al cargar el catálogo de medicamentos y stock:', error);
        this.mensajeMedicamentos = 'No se pudieron cargar los medicamentos.';
        this.cargandoMedicamentos = false;
        this.cdr.detectChanges();
      }
    });
  }

  recargarStockMedicamentos(): void {
    this.comprasService.obtenerMapaStockMedicamentos().subscribe({
      next: (stock) => {
        this.mapaStockPorId = stock.porId;
        this.mapaStockPorNombre = stock.porNombre;

        this.medicamentosCatalogo.forEach((med: any) => {
          const id = Number(med?.id_medicamento ?? med?.id);
          const nombreKey = String(med?.nombre || '').trim().toLowerCase();
          med.stockDisponible = (!isNaN(id) && stock.porId.has(id))
            ? (stock.porId.get(id) ?? 0)
            : (stock.porNombre.get(nombreKey) ?? 0);
        });

        // Actualizar también los no administrados en la lista seleccionada
        this.medicamentosSeleccionados.forEach((item: any) => {
          if (!item.administrado) {
            const id = Number(item.id);
            const nombreKey = String(item.nombre || '').trim().toLowerCase();
            item.stockDisponible = (!isNaN(id) && stock.porId.has(id))
              ? (stock.porId.get(id) ?? 0)
              : (stock.porNombre.get(nombreKey) ?? 0);
          }
        });

        this.cdr.detectChanges();
      }
    });
  }

tarjetaProfesional: string = '';

  agregarMedicamento(medicamento: any): void {
    const nombre = String(
      medicamento?.nombre ||
      medicamento?.nombre_medicamento ||
      medicamento?.medicamento ||
      medicamento?.nombre_producto ||
      ''
    );

    const id = medicamento?.id_medicamento ??
      medicamento?.id ??
      medicamento?.id_medicamento_catalogo ??
      null;

    const yaExiste = this.medicamentosSeleccionados.some((item: any) =>
      (id !== null && item.id === id) ||
      (id === null && item.nombre === nombre)
    );

    if (yaExiste) {
      Swal.fire({
        icon: 'info',
        title: 'Medicamento ya agregado',
        text: 'Este medicamento ya está en la historia clínica.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const nombreKey = String(nombre).trim().toLowerCase();
    const stock = medicamento?.stockDisponible !== undefined
      ? medicamento.stockDisponible
      : ((id !== null && this.mapaStockPorId.has(Number(id)))
          ? (this.mapaStockPorId.get(Number(id)) ?? 0)
          : (this.mapaStockPorNombre.get(nombreKey) ?? 0));

    // REGLA OBLIGATORIA: Agregar a tratamientos NO descuenta stock.
    // Solo vincula el medicamento y deja listo el formulario de administración.
    this.medicamentosSeleccionados.push({
      id,
      nombre: nombre || 'Medicamento sin nombre',
      principio_activo: medicamento?.principio_activo || '',
      concentracion: medicamento?.concentracion || '',
      presentacion: medicamento?.presentacion || '',
      dosis: '',
      via: '',
      frecuencia: '',
      stockDisponible: stock,
      cantidadAAdministrar: 1,
      administrado: false,
      cantidadEfectivaAdministrada: 0,
      administrando: false
    });

    Swal.fire({
      icon: 'success',
      title: 'Medicamento agregado a prescripción',
      text: `${nombre || 'El medicamento'} se agregó a la lista. Para descontarlo de inventario, confirma su administración real en la tarjeta.`,
      timer: 1800,
      showConfirmButton: false
    });
  }

  registrarAdministracion(med: any, indice: number): void {
    if (med.administrado) {
      Swal.fire({
        icon: 'info',
        title: 'Ya administrado',
        text: `Este medicamento ya fue administrado (${med.cantidadEfectivaAdministrada} uds) y descontado de inventario.`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const cantidad = Number(med.cantidadAAdministrar);
    if (isNaN(cantidad) || cantidad <= 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cantidad inválida',
        text: 'Ingresa una cantidad numérica mayor a 0 para registrar la administración.',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const stockActual = Number(med.stockDisponible) || 0;
    if (stockActual <= 0) {
      Swal.fire({
        icon: 'error',
        title: 'Sin existencias en inventario',
        text: `No hay unidades disponibles en inventario para el medicamento "${med.nombre}".`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    if (cantidad > stockActual) {
      Swal.fire({
        icon: 'error',
        title: 'Stock insuficiente',
        text: `Intentas administrar ${cantidad} uds, pero solo quedan ${stockActual} uds disponibles en el inventario.`,
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    const nombreMed = med.nombre || 'el medicamento';

    Swal.fire({
      title: '¿Confirmar administración y descuento?',
      html: `Se registrará la administración física de <b>${cantidad} uds</b> de <b>${nombreMed}</b> al paciente.<br><br><span class="text-xs text-slate-500">Esta acción descontará las unidades directamente de los lotes activos en el inventario de la clínica.</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar y descontar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#64748b'
    }).then((resultado) => {
      if (!resultado.isConfirmed) return;

      med.administrando = true;
      this.cdr.detectChanges();

      this.comprasService.descontarStockMedicamento(med.id, cantidad, med.nombre).subscribe({
        next: (resp) => {
          med.administrando = false;
          med.administrado = true;
          med.cantidadEfectivaAdministrada = cantidad;
          med.stockDisponible = resp.restante;
          this.recargarStockMedicamentos();
          this.cdr.detectChanges();

          Swal.fire({
            icon: 'success',
            title: '¡Administración registrada con éxito!',
            html: `Se descontaron <b>${cantidad} uds</b> de inventario.<br>Stock restante en CBA: <b>${resp.restante} uds</b>.`,
            confirmButtonColor: '#4141A5'
          });
        },
        error: (err) => {
          med.administrando = false;
          this.cdr.detectChanges();
          console.error('Error al descontar stock:', err);
          const msg = err?.message || 'No fue posible registrar la administración en inventario.';
          Swal.fire({
            icon: 'error',
            title: 'Error al descontar inventario',
            text: msg,
            confirmButtonColor: '#4141A5'
          });
        }
      });
    });
  }

  eliminarMedicamento(indice: number): void {
    const med = this.medicamentosSeleccionados[indice];
    if (med && med.administrado) {
      Swal.fire({
        icon: 'warning',
        title: '¿Quitar de la lista?',
        html: `Atención: Ya se registró la administración y se descontaron <b>${med.cantidadEfectivaAdministrada} uds</b> de <b>${med.nombre}</b> en el inventario físico.<br><br>¿Deseas quitar este tratamiento del formulario?`,
        showCancelButton: true,
        confirmButtonText: 'Sí, quitar',
        cancelButtonText: 'Conservar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#4141A5'
      }).then((res) => {
        if (res.isConfirmed) {
          this.medicamentosSeleccionados.splice(indice, 1);
          this.cdr.detectChanges();
        }
      });
      return;
    }
    this.medicamentosSeleccionados.splice(indice, 1);
  }

  // Evaluación física: guardar y recuperar en este navegador
  guardarSistemas(): void {
    try {
      localStorage.setItem('vetericano_sistemas', JSON.stringify(this.sistemas));
      Swal.fire({
        icon: 'success',
        title: '¡Cambios guardados!',
        text: 'La evaluación física se guardó correctamente.',
        confirmButtonColor: '#4141A5'
      });
    } catch (error) {
      console.error('Error al guardar la evaluación:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: 'No fue posible guardar la evaluación.'
      });
    }
  }

  cargarSistemasGuardados(): void {
    try {
      const datosGuardados = localStorage.getItem('vetericano_sistemas');
      if (datosGuardados) {
        const sistemasGuardados = JSON.parse(datosGuardados);
        this.sistemas = { ...this.sistemas, ...sistemasGuardados };
      }
    } catch (error) {
      console.error('Error al recuperar la evaluación:', error);
    }
  }

  // Catálogo de exámenes clínicos
  desplegarExamenes(): void {
    this.mostrarExamenes = !this.mostrarExamenes;

    if (!this.mostrarExamenes || this.examenesClinicos.length > 0) {
      return;
    }

    this.cargandoExamenes = true;
    this.mensajeExamenes = '';

    this.authService.getCatalogo().subscribe({
      next: (respuesta: any) => {
        if (Array.isArray(respuesta)) {
          this.examenesClinicos = respuesta;
        } else if (Array.isArray(respuesta?.results)) {
          this.examenesClinicos = respuesta.results;
        } else if (Array.isArray(respuesta?.data)) {
          this.examenesClinicos = respuesta.data;
        } else {
          this.examenesClinicos = [];
        }

        if (this.examenesClinicos.length === 0) {
          this.mensajeExamenes = 'El catálogo no contiene exámenes clínicos.';
        }

        this.cargandoExamenes = false;
        this.cdr.detectChanges();
      },
      error: (error: any) => {
        console.error('Error al cargar los exámenes:', error);
        this.mensajeExamenes = 'No se pudieron cargar los exámenes clínicos.';
        this.cargandoExamenes = false;
        this.cdr.detectChanges();
      }
    });
  }

  agregarExamen(examen: any): void {
    const nombreExamen = String(
      examen?.nombre ||
      examen?.nombre_examen ||
      examen?.nombre_tipo ||
      examen?.tipo ||
      'Examen clínico'
    );

    const idExamen = examen?.id_examen ?? examen?.id ?? null;
    const yaExiste = this.examenesSolicitados.some((item: any) =>
      (idExamen !== null && item.id_examen === idExamen) ||
      item.nombre === nombreExamen
    );

    if (yaExiste) {
      Swal.fire({
        icon: 'info',
        title: 'Examen ya agregado',
        text: 'Este examen ya se encuentra en la lista de solicitados.',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#4141A5'
      });
      return;
    }

    this.examenesSolicitados.push({
      ...examen,
      id_examen: idExamen,
      nombre: nombreExamen
    });

    Swal.fire({
      icon: 'success',
      title: 'Examen agregado',
      text: `${nombreExamen} se agregó a los exámenes solicitados.`,
      timer: 1400,
      showConfirmButton: false
    });
  }
  nombreAcudiente: string = '';

  eliminarExamen(indice: number): void {
    const examen = this.examenesSolicitados[indice];
    if (!examen) {
      return;
    }

    Swal.fire({
      icon: 'warning',
      title: '¿Deseas eliminar este examen?',
      text: `Se quitará "${examen.nombre}" de los exámenes solicitados.`,
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33',
      cancelButtonColor: '#4141A5',
      reverseButtons: true
    }).then((resultado) => {
      if (resultado.isConfirmed) {
        this.examenesSolicitados.splice(indice, 1);
        Swal.fire({
          icon: 'success',
          title: 'Examen eliminado',
          text: 'El examen se quitó de la lista.',
          timer: 1300,
          showConfirmButton: false
        });
      }
    });
  }
  
}
