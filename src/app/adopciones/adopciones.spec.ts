import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Adopciones } from './adopciones';

describe('Adopciones', () => {
  let component: Adopciones;
  let fixture: ComponentFixture<Adopciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Adopciones],
    }).compileComponents();

    fixture = TestBed.createComponent(Adopciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
