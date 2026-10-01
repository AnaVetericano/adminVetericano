import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HistoriaClinica2 } from './historia-clinica';

describe('HistoriaClinica2', () => {
  let component: HistoriaClinica2;
  let fixture: ComponentFixture<HistoriaClinica2>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriaClinica2],
    }).compileComponents();

    fixture = TestBed.createComponent(HistoriaClinica2);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
