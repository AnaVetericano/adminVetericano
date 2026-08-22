import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrearEspecies } from './crear-especies';

describe('CrearEspecies', () => {
  let component: CrearEspecies;
  let fixture: ComponentFixture<CrearEspecies>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrearEspecies],
    }).compileComponents();

    fixture = TestBed.createComponent(CrearEspecies);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
