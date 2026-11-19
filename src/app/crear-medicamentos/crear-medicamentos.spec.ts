import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';

import { Medicamentos } from './crear-medicamentos';

describe('Medicamentos', () => {
  let component: Medicamentos;
  let fixture: ComponentFixture<Medicamentos>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [Medicamentos],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Medicamentos);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const req = httpMock.expectOne(environment.apiUrlMedicamentos);
    expect(req.request.method).toBe('GET');
    req.flush([]);

    await fixture.whenStable();
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
