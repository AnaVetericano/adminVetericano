import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormularioMedicamentos } from './formulario-medicamentos';

describe('FormularioMedicamentos', () => {
  let component: FormularioMedicamentos;
  let fixture: ComponentFixture<FormularioMedicamentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioMedicamentos],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioMedicamentos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
