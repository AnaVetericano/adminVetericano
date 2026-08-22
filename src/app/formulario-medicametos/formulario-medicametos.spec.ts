import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormularioMedicametos } from './formulario-medicametos';

describe('FormularioMedicametos', () => {
  let component: FormularioMedicametos;
  let fixture: ComponentFixture<FormularioMedicametos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioMedicametos],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioMedicametos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
