import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearMedicamentos } from './crear-medicamentos';

describe('CrearMedicamentos', () => {
  let component: CrearMedicamentos;
  let fixture: ComponentFixture<CrearMedicamentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearMedicamentos],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearMedicamentos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
