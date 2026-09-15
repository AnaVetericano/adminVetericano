import { ComponentFixture, TestBed } from '@angular/core/testing';
import { InicioDeSesionAdministradorComponent } from './inicio-de-sesion-administrador';

describe('InicioDeSesionAdministradorComponent', () => {
  let component: InicioDeSesionAdministradorComponent;
  let fixture: ComponentFixture<InicioDeSesionAdministradorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioDeSesionAdministradorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioDeSesionAdministradorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});