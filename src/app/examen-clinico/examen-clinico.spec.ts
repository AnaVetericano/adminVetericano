import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExamenClinico } from './examen-clinico';

describe('ExamenClinico', () => {
  let component: ExamenClinico;
  let fixture: ComponentFixture<ExamenClinico>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExamenClinico],
    }).compileComponents();

    fixture = TestBed.createComponent(ExamenClinico);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
