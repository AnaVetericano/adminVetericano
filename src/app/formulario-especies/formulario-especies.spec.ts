import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FormularioEspecies } from './formulario-especies';

describe('FormularioEspecies', () => {
  let component: FormularioEspecies;
  let fixture: ComponentFixture<FormularioEspecies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormularioEspecies],
    }).compileComponents();

    fixture = TestBed.createComponent(FormularioEspecies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
