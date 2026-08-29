import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InicioAdministrador } from './Inicio-administrador';

describe('InicioAdministrador', () => {
  let component: InicioAdministrador;
  let fixture: ComponentFixture<InicioAdministrador>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InicioAdministrador],
    }).compileComponents();

    fixture = TestBed.createComponent(InicioAdministrador);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
