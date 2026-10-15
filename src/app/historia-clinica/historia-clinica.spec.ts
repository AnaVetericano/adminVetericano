import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { HistoriaClinica2Component } from './historia-clinica';

describe('HistoriaClinica2Component', () => {
  let component: HistoriaClinica2Component;
  let fixture: ComponentFixture<HistoriaClinica2Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HistoriaClinica2Component],
      providers: [
        provideHttpClient(),
        provideRouter([])
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HistoriaClinica2Component);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
