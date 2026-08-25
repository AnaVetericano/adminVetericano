import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InicioDeSesionAdministrador } from './inicio-de-sesion-administrador';

describe('InicioDeSesionAdministrador', () => {
  let component: InicioDeSesionAdministrador;
  let fixture: ComponentFixture<InicioDeSesionAdministrador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioDeSesionAdministrador],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioDeSesionAdministrador);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
