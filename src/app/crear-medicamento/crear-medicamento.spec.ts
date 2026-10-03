import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearMedicamento } from './crear-medicamento';

describe('CrearMedicamento', () => {
  let component: CrearMedicamento;
  let fixture: ComponentFixture<CrearMedicamento>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearMedicamento],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearMedicamento);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
