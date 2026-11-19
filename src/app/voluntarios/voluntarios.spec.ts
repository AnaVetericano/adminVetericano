import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { Voluntarios } from './voluntarios';

describe('Voluntarios', () => {
  let component: Voluntarios;
  let fixture: ComponentFixture<Voluntarios>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Voluntarios],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Voluntarios);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
