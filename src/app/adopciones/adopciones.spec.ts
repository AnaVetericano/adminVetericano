import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Adopciones } from './adopciones';

describe('Adopciones', () => {
  let component: Adopciones;
  let fixture: ComponentFixture<Adopciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Adopciones],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Adopciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
