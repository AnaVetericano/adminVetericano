import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegistroAdministrador } from './registro-administrador';

describe('RegistroAdministrador', () => {
  let component: RegistroAdministrador;
  let fixture: ComponentFixture<RegistroAdministrador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistroAdministrador],
    }).compileComponents();

    fixture = TestBed.createComponent(RegistroAdministrador);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
