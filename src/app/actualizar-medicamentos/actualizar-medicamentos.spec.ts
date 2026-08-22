import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualizarMedicamentos } from './actualizar-medicamentos';

describe('ActualizarMedicamentos', () => {
  let component: ActualizarMedicamentos;
  let fixture: ComponentFixture<ActualizarMedicamentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualizarMedicamentos],
    }).compileComponents();

    fixture = TestBed.createComponent(ActualizarMedicamentos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
