import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActualizarEspecies } from './actualizar-especies';

describe('ActualizarEspecies', () => {
  let component: ActualizarEspecies;
  let fixture: ComponentFixture<ActualizarEspecies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActualizarEspecies],
    }).compileComponents();

    fixture = TestBed.createComponent(ActualizarEspecies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
