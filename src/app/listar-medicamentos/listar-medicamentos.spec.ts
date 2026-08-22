import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListarMedicamentos } from './listar-medicamentos';

describe('ListarMedicamentos', () => {
  let component: ListarMedicamentos;
  let fixture: ComponentFixture<ListarMedicamentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListarMedicamentos],
    }).compileComponents();

    fixture = TestBed.createComponent(ListarMedicamentos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
