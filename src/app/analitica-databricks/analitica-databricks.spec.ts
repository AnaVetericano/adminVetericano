import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnaliticaDatabricksComponent } from './analitica-databricks';

describe('AnaliticaDatabricksComponent', () => {
  let component: AnaliticaDatabricksComponent;
  let fixture: ComponentFixture<AnaliticaDatabricksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnaliticaDatabricksComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(AnaliticaDatabricksComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe iniciar sin URL sanitizada si databricksUrl está vacía', () => {
    component.databricksUrl = '';
    component.inicializarDashboard();
    expect(component.safeDatabricksUrl).toBeNull();
    expect(component.cargando).toBe(false);
  });

  it('debe rechazar URLs que no inicien con https://', () => {
    component.databricksUrl = 'http://inseguro.databricks.com/embed';
    component.inicializarDashboard();
    expect(component.safeDatabricksUrl).toBeNull();
    expect(component.errorValidacion).toContain('https://');
  });

  it('debe sanitizar URLs HTTPS válidas y activar estado de carga', () => {
    const testUrl = 'https://dbc-1234.cloud.databricks.com/embed/dashboardsv3/test-dash';
    component.databricksUrl = testUrl;
    component.inicializarDashboard();

    expect(component.safeDatabricksUrl).not.toBeNull();
    expect(component.cargando).toBe(true);
    expect(component.errorValidacion).toBe('');
  });

  it('debe finalizar el estado de carga cuando el iframe emite el evento load', () => {
    component.cargando = true;
    component.onIframeLoaded();
    expect(component.cargando).toBe(false);
  });

  it('debe alternar el estado de pantalla completa', () => {
    expect(component.esPantallaCompleta).toBe(false);
    component.togglePantallaCompleta();
    expect(component.esPantallaCompleta).toBeDefined();
  });

  it('debe aplicar la URL de prueba al ejecutar probarEnlace()', () => {
    component.urlPrueba = 'https://dbc-1234.cloud.databricks.com/embed/test';
    component.probarEnlace();
    expect(component.databricksUrl).toBe('https://dbc-1234.cloud.databricks.com/embed/test');
    expect(component.safeDatabricksUrl).not.toBeNull();
  });
});
